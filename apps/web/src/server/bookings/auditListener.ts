import "@tanstack/react-start/server-only";
import type { BookingAuditRepository, NewBookingAudit } from "./BookingAuditRepository";
import type { BookingActor, BookingEvent, BookingListener } from "./events";

type Entry = Omit<NewBookingAudit, "timestamp" | "operationId" | "source">;

const epoch = (date: Date) => date.getTime();

function actorRef(actor: BookingActor | undefined) {
  if (!actor) return { type: "SYSTEM" as const };
  if ("userId" in actor) return { type: "USER" as const, userId: actor.userId };
  return { type: "GUEST" as const, email: actor.email, name: actor.name };
}

function createdEntries(event: BookingEvent, hostUserUuid: string | null): Entry[] {
  const { booking } = event;
  const uid = booking.uid;
  if (event.confirmed)
    return [{ bookingUid: uid, action: "ACCEPTED", fields: { status: { old: "PENDING", new: "ACCEPTED" } } }];
  if (event.seat) {
    const attendee = booking.attendees.find((entry) => entry.email === event.seat?.attendeeEmail);
    return [
      {
        bookingUid: uid,
        action: "SEAT_BOOKED",
        fields: {
          seatReferenceUid: event.seat.referenceUid,
          attendeeEmail: event.seat.attendeeEmail,
          attendeeName: attendee?.name ?? "",
          startTime: epoch(booking.startTime),
          endTime: epoch(booking.endTime),
        },
      },
    ];
  }
  return [
    {
      bookingUid: uid,
      action: "CREATED",
      fields: {
        startTime: epoch(booking.startTime),
        endTime: epoch(booking.endTime),
        status: booking.status,
        hostUserUuid,
      },
    },
  ];
}

function rescheduledEntries(event: BookingEvent, hostUserUuid: string | null): Entry[] {
  const { booking } = event;
  const from = event.rescheduledFrom;
  if (!from) return [];
  const times = {
    startTime: { old: epoch(from.startTime), new: epoch(booking.startTime) },
    endTime: { old: epoch(from.endTime), new: epoch(booking.endTime) },
  };
  // Recorded on the booking that moved, as Cal does; the new one starts its own history.
  const moved: Entry = event.seat
    ? {
        bookingUid: from.uid,
        action: "SEAT_RESCHEDULED",
        fields: {
          seatReferenceUid: event.seat.referenceUid,
          attendeeEmail: event.seat.attendeeEmail,
          ...times,
          rescheduledToBookingUid: { old: null, new: booking.uid },
        },
      }
    : {
        bookingUid: from.uid,
        action: "RESCHEDULED",
        fields: { ...times, rescheduledToUid: { old: null, new: booking.uid } },
      };
  if (from.uid === booking.uid) return [moved];
  const created: Entry = {
    bookingUid: booking.uid,
    action: "CREATED",
    fields: {
      startTime: epoch(booking.startTime),
      endTime: epoch(booking.endTime),
      status: booking.status,
      hostUserUuid,
      ...(event.seat ? { seatReferenceUid: event.seat.referenceUid } : {}),
    },
  };
  return [moved, created];
}

function cancelledEntries(event: BookingEvent): Entry[] {
  const { booking } = event;
  if (event.rescheduleRequested)
    return [
      {
        bookingUid: booking.uid,
        action: "RESCHEDULE_REQUESTED",
        fields: { rescheduleReason: booking.cancellationReason, rescheduledRequestedBy: booking.cancelledBy },
      },
    ];
  return [
    {
      bookingUid: booking.uid,
      action: "CANCELLED",
      fields: {
        cancellationReason: booking.cancellationReason,
        cancelledBy: booking.cancelledBy,
        status: { old: event.previousStatus ?? null, new: "CANCELLED" },
      },
    },
  ];
}

/** Changes the host makes after booking: no-shows, guests and location. */
function changeEntries(event: BookingEvent): Entry[] {
  const uid = event.booking.uid;
  switch (event.type) {
    case "BOOKING_NO_SHOW_UPDATED":
      return [
        {
          bookingUid: uid,
          action: "NO_SHOW_UPDATED",
          fields: {
            attendeesNoShow: (event.noShow?.attendees ?? []).map((attendee) => ({
              attendeeEmail: attendee.email,
              noShow: { old: null, new: attendee.noShow },
            })),
          },
        },
      ];
    case "BOOKING_GUESTS_ADDED":
      return [{ bookingUid: uid, action: "ATTENDEE_ADDED", fields: { added: event.guestsAdded ?? [] } }];
    case "BOOKING_LOCATION_CHANGED":
      return [
        {
          bookingUid: uid,
          action: "LOCATION_CHANGED",
          fields: { location: { old: event.previousLocation ?? null, new: event.booking.location } },
        },
      ];
    default:
      return [];
  }
}

/** What Cal's audit trail records for an event, in Cal's per-action field shapes. */
export function auditEntries(event: BookingEvent, hostUserUuid: string | null): Entry[] {
  const { booking } = event;
  switch (event.type) {
    case "BOOKING_CREATED":
    case "BOOKING_REQUESTED":
      return createdEntries(event, hostUserUuid);
    case "BOOKING_RESCHEDULED":
      return rescheduledEntries(event, hostUserUuid);
    case "BOOKING_CANCELLED":
      return cancelledEntries(event);
    case "BOOKING_REJECTED":
      return [
        {
          bookingUid: booking.uid,
          action: "REJECTED",
          fields: { rejectionReason: booking.rejectionReason, status: { old: "PENDING", new: "REJECTED" } },
        },
      ];
    default:
      return changeEntries(event);
  }
}

/** Records booking events in the audit trail, each occurrence of a series on its own booking. */
export function createAuditListener(
  repo: BookingAuditRepository,
  now: () => Date = () => new Date()
): BookingListener {
  return async (event) => {
    const hostUserUuid = await repo.userUuid(event.booking.organizer.id);
    const entries = auditEntries(event, hostUserUuid);
    if (!entries.length) return;
    const actorId = await repo.actorId(actorRef(event.actor));
    const timestamp = now();
    await repo.insertMany(
      actorId,
      entries.map((entry) => ({
        ...entry,
        timestamp,
        operationId: event.operationId ?? crypto.randomUUID(),
        source: "WEBAPP",
      }))
    );
  };
}

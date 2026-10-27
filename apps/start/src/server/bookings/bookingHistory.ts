import type { BookingAuditAction } from "@calcom/db/enums";

type Change<T> = { old: T | null; new: T };
type Fields = Record<string, unknown>;

/** A translated line of a booking's history: a key under booking_audit_action, and its values. */
type HistoryTitle = { key: string; values: Record<string, string> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function change<T>(fields: Fields, name: string): Change<T> | null {
  const value = fields[name];
  return isRecord(value) && "new" in value ? (value as Change<T>) : null;
}

const SIMPLE_KEYS: Partial<Record<BookingAuditAction, string>> = {
  CANCELLED: "cancelled",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  RESCHEDULE_REQUESTED: "reschedule_requested",
  ATTENDEE_ADDED: "attendee_added",
  ATTENDEE_REMOVED: "attendee_removed",
  REASSIGNMENT: "reassignment",
  SEAT_BOOKED: "seat_booked",
};

/** Cal stores `{ version, fields }`; anything else reads as having no details. */
export function auditFields(data: unknown): Fields {
  return isRecord(data) && isRecord(data.fields) ? data.fields : {};
}

/**
 * The title Cal's booking history shows for an audit record. `formatDate` renders the epoch
 * milliseconds Cal stores in the viewer's time zone; `hostName` resolves a user's uuid.
 */
export function historyTitle(
  action: BookingAuditAction,
  data: unknown,
  formatDate: (epochMs: number) => string,
  hostName: (userUuid: string | null) => string
): HistoryTitle {
  const fields = auditFields(data);
  const title = (key: string, values: Record<string, string> = {}) => ({
    key: `booking_audit_action.${key}`,
    values,
  });
  switch (action) {
    case "CREATED": {
      if (fields.status === "AWAITING_HOST") return title("created_awaiting_host");
      const host = hostName(typeof fields.hostUserUuid === "string" ? fields.hostUserUuid : null);
      return title(fields.seatReferenceUid ? "created_with_seat" : "created", { host });
    }
    case "RESCHEDULED":
    case "SEAT_RESCHEDULED": {
      const start = change<number>(fields, "startTime");
      return title(action === "RESCHEDULED" ? "rescheduled" : "seat_rescheduled", {
        oldDate: start?.old ? formatDate(start.old) : "",
        newDate: start?.new ? formatDate(start.new) : "",
      });
    }
    case "LOCATION_CHANGED": {
      const location = change<string>(fields, "location");
      if (!location) return title("location_changed");
      return title("location_changed_from_to", {
        fromLocation: location.old ?? "-",
        toLocation: location.new ?? "-",
      });
    }
    case "NO_SHOW_UPDATED": {
      if (fields.host && !fields.attendeesNoShow) return title("host_no_show_updated");
      if (fields.attendeesNoShow && !fields.host) return title("attendee_no_show_updated");
      return title("no_show_updated");
    }
    default:
      return title(SIMPLE_KEYS[action] ?? "error_processing", { actionType: action });
  }
}

/** The details shown under a history line, as label/value pairs. */
export function historyDetails(
  action: BookingAuditAction,
  data: unknown
): { label: string; value: string }[] {
  const fields = auditFields(data);
  const text = (name: string) => (typeof fields[name] === "string" ? (fields[name] as string) : null);
  switch (action) {
    case "CANCELLED": {
      const reason = text("cancellationReason");
      return reason ? [{ label: "cancellation_reason", value: reason }] : [];
    }
    case "REJECTED": {
      const reason = text("rejectionReason");
      return reason ? [{ label: "rejection_reason", value: reason }] : [];
    }
    case "RESCHEDULE_REQUESTED": {
      const reason = text("rescheduleReason");
      return reason ? [{ label: "reason_for_reschedule_request", value: reason }] : [];
    }
    case "ATTENDEE_ADDED":
    case "ATTENDEE_REMOVED": {
      const emails = fields[action === "ATTENDEE_ADDED" ? "added" : "removed"];
      return Array.isArray(emails)
        ? [{ label: "booking_audit_action.attendees", value: emails.join(", ") }]
        : [];
    }
    case "NO_SHOW_UPDATED": {
      const attendees = Array.isArray(fields.attendeesNoShow) ? fields.attendeesNoShow : [];
      return attendees.filter(isRecord).map((entry) => {
        const noShow = isRecord(entry.noShow) && entry.noShow.new === true;
        return { label: String(entry.attendeeEmail), value: noShow ? "yes" : "no" };
      });
    }
    default:
      return [];
  }
}

export type { HistoryTitle };

import "@tanstack/react-start/server-only";
import slugify from "@calcom/lib/slugify";
import type { EventTypeRow } from "../event-types/EventTypeRepository";

/** Cal's getUsernameList: "/alice+bob" (or a space, which is how "+" can arrive) names a group. */
export function parseUsernameList(username: string): string[] {
  return username
    .replace(/( |%20|%2b)/gi, "+")
    .split("+")
    .map((name) => slugify(name))
    .filter(Boolean);
}

export function isDynamicGroup(username: string): boolean {
  return parseUsernameList(username).length > 1;
}

/** The slug group links use; any slug books the same event, as in Cal. */
export const DYNAMIC_EVENT_SLUG = "dynamic";

/**
 * Cal's dynamicEvent: a 30-minute group meeting (15 to 90 to choose from) with 2 hours' notice and
 * no guests, owned by nobody. `id` 0 stands for "no event type": bookings get a null eventTypeId.
 */
export function dynamicEventType(organizerId: number, title: string): EventTypeRow {
  return {
    id: 0,
    title,
    slug: DYNAMIC_EVENT_SLUG,
    length: 30,
    hidden: false,
    description: null,
    eventTypeColor: null,
    userId: organizerId,
    teamId: null,
    schedulingType: null,
    assignAllTeamMembers: false,
    scheduleId: null,
    locations: [],
    minimumBookingNotice: 120,
    beforeEventBuffer: 0,
    afterEventBuffer: 0,
    slotInterval: null,
    periodType: "UNLIMITED",
    periodDays: null,
    periodCountCalendarDays: true,
    requiresConfirmation: false,
    periodStartDate: null,
    periodEndDate: null,
    offsetStart: 0,
    onlyShowFirstAvailableSlot: false,
    bookingLimits: null,
    durationLimits: null,
    maxActiveBookingsPerBooker: null,
    maxActiveBookingPerBookerOfferReschedule: false,
    bookingFields: null,
    disableGuests: true,
    metadata: { multipleDuration: [15, 30, 45, 60, 90] },
    requiresConfirmationWillBlockSlot: false,
    disableCancelling: false,
    disableRescheduling: false,
    minimumRescheduleNotice: null,
    successRedirectUrl: null,
    forwardParamsSuccessRedirect: true,
    eventName: title,
    hideCalendarNotes: false,
    hideCalendarEventDetails: false,
    hideOrganizerEmail: false,
    lockTimeZoneToggleOnBookingPage: false,
    lockedTimeZone: null,
    interfaceLanguage: null,
    requiresBookerEmailVerification: false,
    recurringEvent: null,
    seatsPerTimeSlot: null,
    seatsShowAttendees: false,
    seatsShowAvailabilityCount: true,
  };
}

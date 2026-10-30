import { isIntervalLimitOrderValid } from "@calcom/scheduling/limits";
import { z } from "zod";
import {
  DYNAMIC_VIDEO_LOCATION_TYPES,
  findAppByLocationType,
  isValidAppLink,
  STATIC_LINK_LOCATION_TYPES,
} from "~/lib/apps";
import { bookerLayoutsSchema } from "~/lib/booker-layouts";
import { bookingFieldInputSchema } from "~/lib/booking-fields";
import { SUPPORTED_LOCALES } from "~/lib/locales";
import { eventPaymentSchema } from "../payments/paidEvent";

const limitValue = z.number().int().min(1).max(100_000).optional();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Every occurrence is inserted in one batch, so a series is capped. */
const MAX_RECURRING_COUNT = 100;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Static-link apps only accept links that look like theirs, as in Cal. */
function checkAppLinks(locations: { type: string; link?: string }[], context: z.RefinementCtx) {
  for (const [index, location] of locations.entries()) {
    if (location.link === undefined || location.type === "link") continue;
    const app = findAppByLocationType(location.type);
    if (app && !isValidAppLink(app, location.link))
      context.addIssue({ code: z.ZodIssueCode.custom, path: [index, "link"], message: "invalid_link" });
  }
}

// Stored in EventType.locations using Cal's existing location shapes, so data stays portable.
export const eventLocationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("inPerson"), address: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal("link"), link: z.string().trim().url().max(2000) }),
  z.object({ type: z.literal("phone") }),
  z.object({
    type: z.literal("userPhone"),
    hostPhoneNumber: z
      .string()
      .trim()
      .regex(/^\+?[\d\s().-]{6,20}$/),
  }),
  z.object({ type: z.literal("integrations:google:meet") }),
  z.object({ type: z.enum(DYNAMIC_VIDEO_LOCATION_TYPES) }),
  // The host's own room link for apps like Whereby; checked against the app's pattern below.
  z.object({ type: z.enum(STATIC_LINK_LOCATION_TYPES), link: z.string().trim().url().max(2000) }),
]);

export type EventLocation = z.infer<typeof eventLocationSchema>;

/** Where a host can move an existing booking: any location but the attendee's phone, which they'd have to give. */
export const editableLocationSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("inPerson"), address: z.string().trim().min(1).max(500) }),
    z.object({ type: z.literal("link"), link: z.string().trim().url().max(2000) }),
    z.object({
      type: z.literal("userPhone"),
      hostPhoneNumber: z
        .string()
        .trim()
        .regex(/^\+?[\d\s().-]{6,20}$/),
    }),
    z.object({ type: z.literal("integrations:google:meet") }),
    // The video listener creates the meeting for the booking's new location.
    z.object({ type: z.enum(DYNAMIC_VIDEO_LOCATION_TYPES) }),
    z.object({ type: z.enum(STATIC_LINK_LOCATION_TYPES), link: z.string().trim().url().max(2000) }),
  ])
  .superRefine((location, context) => checkAppLinks([location], context));

export type EditableLocation = z.infer<typeof editableLocationSchema>;

/** The booking's `location` for a chosen location, as when it was booked. */
export function locationValue(location: EditableLocation): string {
  switch (location.type) {
    case "inPerson":
      return location.address;
    case "link":
      return location.link;
    case "userPhone":
      return location.hostPhoneNumber;
    default:
      // Static-link apps meet in the host's room; conferencing apps get their link from the app.
      return "link" in location ? location.link : location.type;
  }
}

/** Cal's bookingLimits / durationLimits: a booking count or minutes per period. */
export const intervalLimitSchema = z
  .object({ PER_DAY: limitValue, PER_WEEK: limitValue, PER_MONTH: limitValue, PER_YEAR: limitValue })
  .refine(isIntervalLimitOrderValid, { message: "event_setup_booking_limits_error" });

export const eventTypeFields = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable(),
  length: z.number().int().min(1).max(1440),
  /** Cal's metadata.multipleDuration: lengths the booker may pick, `length` being the default. */
  multipleDuration: z.array(z.number().int().min(1).max(1440)).min(1).max(30).nullable(),
  /** Cal's recurringEvent with RRule frequencies: 0 yearly, 1 monthly, 2 weekly. */
  recurringEvent: z
    .object({
      freq: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      interval: z.number().int().min(1).max(100),
      count: z.number().int().min(1).max(MAX_RECURRING_COUNT),
    })
    .nullable(),
  /** Cal's seats: several bookers join one booking until it's full. */
  seatsPerTimeSlot: z.number().int().min(1).max(1000).nullable(),
  seatsShowAttendees: z.boolean(),
  seatsShowAvailabilityCount: z.boolean(),
  hidden: z.boolean(),
  scheduleId: z.number().int().positive().nullable(),
  locations: z.array(eventLocationSchema).max(10).superRefine(checkAppLinks),
  minimumBookingNotice: z.number().int().min(0).max(525600),
  beforeEventBuffer: z.number().int().min(0).max(1440),
  afterEventBuffer: z.number().int().min(0).max(1440),
  slotInterval: z.number().int().min(1).max(1440).nullable(),
  periodType: z.enum(["UNLIMITED", "ROLLING", "ROLLING_WINDOW", "RANGE"]),
  periodDays: z.number().int().min(1).max(3650).nullable(),
  periodCountCalendarDays: z.boolean(),
  periodStartDate: isoDate.nullable(),
  periodEndDate: isoDate.nullable(),
  offsetStart: z.number().int().min(0).max(1440),
  onlyShowFirstAvailableSlot: z.boolean(),
  bookingLimits: intervalLimitSchema.nullable(),
  durationLimits: intervalLimitSchema.nullable(),
  maxActiveBookingsPerBooker: z.number().int().min(1).max(1000).nullable(),
  maxActiveBookingPerBookerOfferReschedule: z.boolean(),
  requiresConfirmation: z.boolean(),
  /** Cal's metadata.requiresConfirmationThreshold: only bookings made with less notice need confirming. */
  requiresConfirmationThreshold: z
    .object({ time: z.number().int().min(1).max(100_000), unit: z.enum(["minutes", "hours"]) })
    .nullable(),
  requiresConfirmationWillBlockSlot: z.boolean(),
  disableCancelling: z.boolean(),
  disableRescheduling: z.boolean(),
  minimumRescheduleNotice: z.number().int().min(1).max(525_600).nullable(),
  successRedirectUrl: z
    .string()
    .trim()
    .url()
    .max(2000)
    .refine((url) => /^https?:\/\//i.test(url), { message: "invalid_url_error_message" })
    .nullable(),
  forwardParamsSuccessRedirect: z.boolean(),
  eventName: z.string().trim().max(1000).nullable(),
  hideCalendarNotes: z.boolean(),
  hideCalendarEventDetails: z.boolean(),
  hideOrganizerEmail: z.boolean(),
  requiresBookerEmailVerification: z.boolean(),
  lockTimeZoneToggleOnBookingPage: z.boolean(),
  lockedTimeZone: z.string().max(100).nullable(),
  /** Cal's eventTypeColor, shown next to the event and its bookings. */
  eventTypeColor: z.object({ lightEventTypeColor: hexColor, darkEventTypeColor: hexColor }).nullable(),
  /** Cal's metadata.bookerLayouts; null follows the host's default from Appearance. */
  bookerLayouts: bookerLayoutsSchema.nullable(),
  /** The booking page's language; null follows the visitor's browser. */
  interfaceLanguage: z
    .string()
    .refine((locale) => SUPPORTED_LOCALES.includes(locale))
    .nullable(),
  /** Cal's metadata.disableStandardEmails.confirmation: leave confirmations to workflows. */
  disableConfirmationEmails: z.object({ host: z.boolean(), attendee: z.boolean() }),
  bookingFields: z.array(bookingFieldInputSchema).max(50),
  /**
   * Cal's private links. A link expires at the end of `expiresAt` (host's time zone) if set,
   * otherwise after `maxUsageCount` bookings. `usageCount` is shown, never written.
   */
  /** Cal's metadata.apps.stripe for a paid event; null is free. Left out, it stays as it is. */
  payment: eventPaymentSchema.nullable().optional(),
  privateLinks: z
    .array(
      z.object({
        link: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
        expiresAt: isoDate.nullable(),
        maxUsageCount: z.number().int().min(1).max(100_000),
        usageCount: z.number().int().min(0).optional(),
      })
    )
    .max(50),
});

export const eventTypeInputSchema = eventTypeFields
  // Cal's limits on seats: they can't combine with these.
  .refine((input) => !input.seatsPerTimeSlot || !input.requiresConfirmation, {
    path: ["seatsPerTimeSlot"],
    message: "seat_options_doesnt_support_confirmation",
  })
  .refine((input) => !input.seatsPerTimeSlot || !input.recurringEvent, {
    path: ["seatsPerTimeSlot"],
    message: "recurring_event_seats_error",
  })
  .refine((input) => !input.seatsPerTimeSlot || !input.multipleDuration, {
    path: ["seatsPerTimeSlot"],
    message: "seat_options_doesnt_multiple_durations",
  })
  .refine((input) => !input.seatsPerTimeSlot || input.locations.length <= 1, {
    path: ["seatsPerTimeSlot"],
    message: "seats_option_doesnt_support_multi_location",
  })
  // Payments are taken once per booking here; Cal's per-seat and per-series charging isn't supported.
  .refine((input) => !input.payment || (!input.seatsPerTimeSlot && !input.recurringEvent), {
    path: ["payment"],
    message: "paid_events_dont_support_seats_or_recurring",
  })
  .refine((input) => !input.recurringEvent || !input.maxActiveBookingsPerBooker, {
    path: ["recurringEvent"],
    message: "recurring_event_doesnt_support_booker_booking_limit",
  })
  .refine((input) => !input.multipleDuration || input.multipleDuration.includes(input.length), {
    path: ["length"],
    message: "event_setup_multiple_duration_default_error",
  })
  .refine((input) => !["ROLLING", "ROLLING_WINDOW"].includes(input.periodType) || input.periodDays !== null, {
    path: ["periodDays"],
  })
  .refine(
    (input) =>
      input.periodType !== "RANGE" ||
      (input.periodStartDate !== null &&
        input.periodEndDate !== null &&
        input.periodStartDate <= input.periodEndDate),
    { path: ["periodEndDate"], message: "start_date_must_be_before_end_date" }
  );

export type EventTypeInput = z.infer<typeof eventTypeInputSchema>;

export const newEventTypeSchema = eventTypeFields.pick({
  title: true,
  slug: true,
  description: true,
  length: true,
});

export type NewEventTypeInput = z.infer<typeof newEventTypeSchema>;

export type EventTypeDto = EventTypeInput & { id: number };

export type EventTypeSummaryDto = Pick<
  EventTypeDto,
  "id" | "title" | "slug" | "length" | "hidden" | "description" | "eventTypeColor"
>;

export { MAX_RECURRING_COUNT };

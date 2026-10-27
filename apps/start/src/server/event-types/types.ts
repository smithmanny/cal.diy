import { isIntervalLimitOrderValid } from "@calcom/scheduling/limits";
import { z } from "zod";

const limitValue = z.number().int().min(1).max(100_000).optional();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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
]);

export type EventLocation = z.infer<typeof eventLocationSchema>;

/** Cal's bookingLimits / durationLimits: a booking count or minutes per period. */
export const intervalLimitSchema = z
  .object({ PER_DAY: limitValue, PER_WEEK: limitValue, PER_MONTH: limitValue, PER_YEAR: limitValue })
  .refine(isIntervalLimitOrderValid, { message: "event_setup_booking_limits_error" });

export const eventTypeFields = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable(),
  length: z.number().int().min(1).max(1440),
  hidden: z.boolean(),
  scheduleId: z.number().int().positive().nullable(),
  locations: z.array(eventLocationSchema).max(10),
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
});

export const eventTypeInputSchema = eventTypeFields
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
  "id" | "title" | "slug" | "length" | "hidden" | "description"
>;

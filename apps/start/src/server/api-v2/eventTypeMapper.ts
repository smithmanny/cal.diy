import { z } from "zod";
import type { EventLocation, EventTypeDto, EventTypeInput } from "../event-types/types";
import type { OwnerRow } from "./ApiUserRepository";

const EVENT_TYPES_API_VERSION = "2024-06-14";

const FREQUENCIES = ["yearly", "monthly", "weekly"] as const;
const LAYOUTS = { month: "month_view", week: "week_view", column: "column_view" } as const;
const disabled = z.object({ disabled: z.literal(true) }).strict();
const minutes = z.number().int().min(0).max(525_600);

/** Cal's InputLocation_2024_06_14 variants this app supports. */
const locationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("address"),
    address: z.string().trim().min(1).max(500),
    public: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("link"),
    link: z.string().trim().url().max(2000),
    public: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("phone"),
    phone: z.string().trim().min(6).max(20),
    public: z.boolean().optional(),
  }),
  z.object({ type: z.literal("attendeePhone") }),
  z.object({ type: z.literal("integration"), integration: z.literal("google-meet") }),
]);

const limitsSchema = z.union([
  disabled,
  z.object({
    day: z.number().int().min(1).optional(),
    week: z.number().int().min(1).optional(),
    month: z.number().int().min(1).optional(),
    year: z.number().int().min(1).optional(),
  }),
]);

const bookingWindowSchema = z.union([
  disabled,
  z.object({
    type: z.enum(["businessDays", "calendarDays"]),
    value: z.number().int().min(1).max(3650),
    rolling: z.boolean().optional(),
  }),
  z.object({ type: z.literal("range"), value: z.tuple([z.string(), z.string()]) }),
]);

/** Cal's CreateEventTypeInput_2024_06_14, for the settings this app has. Unknown fields are rejected. */
const eventTypeFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200),
    lengthInMinutes: z.number().int().min(1).max(1440),
    lengthInMinutesOptions: z.array(z.number().int().min(1).max(1440)).min(1).max(30),
    description: z.string().max(5000),
    locations: z.array(locationSchema).max(10),
    slotInterval: z.number().int().min(1).max(1440).nullable(),
    minimumBookingNotice: minutes,
    beforeEventBuffer: z.number().int().min(0).max(1440),
    afterEventBuffer: z.number().int().min(0).max(1440),
    scheduleId: z.number().int().positive().nullable(),
    hidden: z.boolean(),
    recurrence: z.union([
      disabled,
      z.object({
        frequency: z.enum(FREQUENCIES),
        interval: z.number().int().min(1),
        occurrences: z.number().int().min(1),
      }),
    ]),
    bookingLimitsCount: limitsSchema,
    bookingLimitsDuration: limitsSchema,
    bookerActiveBookingsLimit: z.union([
      disabled,
      z.object({ maximumActiveBookings: z.number().int().min(1), offerReschedule: z.boolean().optional() }),
    ]),
    onlyShowFirstAvailableSlot: z.boolean(),
    bookingWindow: bookingWindowSchema,
    bookerLayouts: z.object({
      defaultLayout: z.enum(["month", "week", "column"]),
      enabledLayouts: z.array(z.enum(["month", "week", "column"])).min(1),
    }),
    confirmationPolicy: z.union([
      disabled,
      z.object({
        type: z.enum(["always", "time"]),
        noticeThreshold: z
          .object({ unit: z.enum(["minutes", "hours"]), count: z.number().int().min(1) })
          .optional(),
        blockUnconfirmedBookingsInBooker: z.boolean(),
      }),
    ]),
    requiresBookerEmailVerification: z.boolean(),
    hideCalendarNotes: z.boolean(),
    hideCalendarEventDetails: z.boolean(),
    hideOrganizerEmail: z.boolean(),
    lockTimeZoneToggleOnBookingPage: z.boolean(),
    color: z.object({ lightThemeHex: z.string(), darkThemeHex: z.string() }),
    seats: z.union([
      disabled,
      z.object({
        seatsPerTimeSlot: z.number().int().min(1),
        showAttendeeInfo: z.boolean(),
        showAvailabilityCount: z.boolean(),
      }),
    ]),
    offsetStart: z.number().int().min(0).max(1440),
    customName: z.string().max(1000),
    successRedirectUrl: z.string().url().max(2000).nullable(),
    forwardParamsSuccessRedirect: z.boolean(),
    disableCancelling: z.object({ disabled: z.boolean() }),
    disableRescheduling: z.object({
      disabled: z.boolean().optional(),
      minutesBefore: z.number().int().min(1).optional(),
    }),
    interfaceLanguage: z.string().max(20).nullable(),
  })
  .partial()
  .strict();

const createEventTypeInputSchema = eventTypeFieldsSchema.required({
  title: true,
  slug: true,
  lengthInMinutes: true,
});

const updateEventTypeInputSchema = eventTypeFieldsSchema;

type EventTypeApiInput = z.infer<typeof eventTypeFieldsSchema>;

function isDisabled(value: unknown): value is { disabled: true } {
  return Boolean(value && typeof value === "object" && "disabled" in value && value.disabled === true);
}

function toLocation(location: z.infer<typeof locationSchema>): EventLocation {
  switch (location.type) {
    case "address":
      return { type: "inPerson", address: location.address };
    case "link":
      return { type: "link", link: location.link };
    case "phone":
      return { type: "userPhone", hostPhoneNumber: location.phone };
    case "attendeePhone":
      return { type: "phone" };
    case "integration":
      return { type: "integrations:google:meet" };
  }
}

function fromLocation(location: EventLocation) {
  switch (location.type) {
    case "inPerson":
      return { type: "address", address: location.address, public: true };
    case "link":
      return { type: "link", link: location.link, public: true };
    case "userPhone":
      return { type: "phone", phone: location.hostPhoneNumber, public: true };
    case "phone":
      return { type: "attendeePhone" };
    case "integrations:google:meet":
      return { type: "integration", integration: "google-meet" };
  }
}

type Limits = z.infer<typeof limitsSchema>;

function toLimits(limits: Limits): EventTypeInput["bookingLimits"] {
  if (isDisabled(limits) || !("day" in limits || "week" in limits || "month" in limits || "year" in limits))
    return null;
  return { PER_DAY: limits.day, PER_WEEK: limits.week, PER_MONTH: limits.month, PER_YEAR: limits.year };
}

function fromLimits(limits: EventTypeInput["bookingLimits"]) {
  if (!limits) return undefined;
  return {
    day: limits.PER_DAY,
    week: limits.PER_WEEK,
    month: limits.PER_MONTH,
    year: limits.PER_YEAR,
    disabled: false,
  };
}

function toBookingWindow(window: z.infer<typeof bookingWindowSchema>): Partial<EventTypeInput> {
  if (isDisabled(window))
    return { periodType: "UNLIMITED", periodDays: null, periodStartDate: null, periodEndDate: null };
  if (window.type === "range")
    return {
      periodType: "RANGE",
      periodStartDate: window.value[0].slice(0, 10),
      periodEndDate: window.value[1].slice(0, 10),
    };
  return {
    periodType: window.rolling ? "ROLLING_WINDOW" : "ROLLING",
    periodDays: window.value,
    periodCountCalendarDays: window.type === "calendarDays",
  };
}

function fromBookingWindow(dto: EventTypeDto) {
  if (dto.periodType === "RANGE")
    return { type: "range", value: [dto.periodStartDate, dto.periodEndDate], disabled: false };
  if (dto.periodType === "ROLLING" || dto.periodType === "ROLLING_WINDOW")
    return {
      type: dto.periodCountCalendarDays ? "calendarDays" : "businessDays",
      value: dto.periodDays,
      rolling: dto.periodType === "ROLLING_WINDOW",
      disabled: false,
    };
  return undefined;
}

function toConfirmation(
  policy: NonNullable<EventTypeApiInput["confirmationPolicy"]>
): Partial<EventTypeInput> {
  if (isDisabled(policy))
    return {
      requiresConfirmation: false,
      requiresConfirmationThreshold: null,
      requiresConfirmationWillBlockSlot: false,
    };
  const threshold = policy.type === "time" ? policy.noticeThreshold : undefined;
  return {
    requiresConfirmation: true,
    requiresConfirmationThreshold: threshold ? { time: threshold.count, unit: threshold.unit } : null,
    requiresConfirmationWillBlockSlot: policy.blockUnconfirmedBookingsInBooker,
  };
}

function toSeats(seats: NonNullable<EventTypeApiInput["seats"]>): Partial<EventTypeInput> {
  if (isDisabled(seats)) return { seatsPerTimeSlot: null };
  return {
    seatsPerTimeSlot: seats.seatsPerTimeSlot,
    seatsShowAttendees: seats.showAttendeeInfo,
    seatsShowAvailabilityCount: seats.showAvailabilityCount,
  };
}

/** Settings whose shape is the same in both, apart from the name. */
function simpleFields(input: EventTypeApiInput): Partial<EventTypeInput> {
  const fields: Partial<EventTypeInput> = {
    title: input.title,
    slug: input.slug,
    length: input.lengthInMinutes,
    multipleDuration: input.lengthInMinutesOptions,
    description: input.description,
    slotInterval: input.slotInterval,
    minimumBookingNotice: input.minimumBookingNotice,
    beforeEventBuffer: input.beforeEventBuffer,
    afterEventBuffer: input.afterEventBuffer,
    scheduleId: input.scheduleId,
    hidden: input.hidden,
    onlyShowFirstAvailableSlot: input.onlyShowFirstAvailableSlot,
    requiresBookerEmailVerification: input.requiresBookerEmailVerification,
    hideCalendarNotes: input.hideCalendarNotes,
    hideCalendarEventDetails: input.hideCalendarEventDetails,
    hideOrganizerEmail: input.hideOrganizerEmail,
    lockTimeZoneToggleOnBookingPage: input.lockTimeZoneToggleOnBookingPage,
    offsetStart: input.offsetStart,
    eventName: input.customName === undefined ? undefined : input.customName || null,
    successRedirectUrl: input.successRedirectUrl,
    forwardParamsSuccessRedirect: input.forwardParamsSuccessRedirect,
    disableCancelling: input.disableCancelling?.disabled,
    interfaceLanguage: input.interfaceLanguage,
    locations: input.locations?.map(toLocation),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

/** Sub-objects in Cal's API that map onto several of the app's settings. */
function nestedFields(input: EventTypeApiInput): Partial<EventTypeInput> {
  const { recurrence, bookerActiveBookingsLimit: active, disableRescheduling, color, bookerLayouts } = input;
  return {
    ...(recurrence && {
      recurringEvent: isDisabled(recurrence)
        ? null
        : {
            freq: FREQUENCIES.indexOf(recurrence.frequency) as 0 | 1 | 2,
            interval: recurrence.interval,
            count: recurrence.occurrences,
          },
    }),
    ...(input.bookingLimitsCount && { bookingLimits: toLimits(input.bookingLimitsCount) }),
    ...(input.bookingLimitsDuration && { durationLimits: toLimits(input.bookingLimitsDuration) }),
    ...(active && {
      maxActiveBookingsPerBooker: isDisabled(active) ? null : active.maximumActiveBookings,
      maxActiveBookingPerBookerOfferReschedule: !isDisabled(active) && Boolean(active.offerReschedule),
    }),
    ...(input.bookingWindow && toBookingWindow(input.bookingWindow)),
    ...(input.confirmationPolicy && toConfirmation(input.confirmationPolicy)),
    ...(input.seats && toSeats(input.seats)),
    ...(disableRescheduling && {
      disableRescheduling: Boolean(disableRescheduling.disabled),
      minimumRescheduleNotice: disableRescheduling.minutesBefore ?? null,
    }),
    ...(color && {
      eventTypeColor: { lightEventTypeColor: color.lightThemeHex, darkEventTypeColor: color.darkThemeHex },
    }),
    ...(bookerLayouts && {
      bookerLayouts: {
        defaultLayout: LAYOUTS[bookerLayouts.defaultLayout],
        enabledLayouts: bookerLayouts.enabledLayouts.map((layout) => LAYOUTS[layout]),
      },
    }),
  };
}

/** The event type's settings after applying the API's changes; the service validates the result. */
function applyEventTypeInput(current: EventTypeInput, input: EventTypeApiInput): EventTypeInput {
  return { ...current, ...simpleFields(input), ...nestedFields(input) };
}

function bookingFieldsOutput(dto: EventTypeDto) {
  return dto.bookingFields.map((field) => ({
    type: field.name === "location" ? "radioInput" : field.type,
    slug: field.name,
    label: field.label ?? field.defaultLabel,
    placeholder: field.placeholder ?? field.defaultPlaceholder,
    required: field.required,
    hidden: field.hidden,
    isDefault: Boolean(field.editable?.startsWith("system")),
    ...(field.options ? { options: field.options.map((option) => option.value) } : {}),
  }));
}

function optionalOutputs(dto: EventTypeDto) {
  return {
    bookingLimitsCount: fromLimits(dto.bookingLimits),
    bookingLimitsDuration: fromLimits(dto.durationLimits),
    bookerActiveBookingsLimit: dto.maxActiveBookingsPerBooker
      ? {
          maximumActiveBookings: dto.maxActiveBookingsPerBooker,
          offerReschedule: dto.maxActiveBookingPerBookerOfferReschedule,
        }
      : undefined,
    bookingWindow: fromBookingWindow(dto),
    bookerLayouts: dto.bookerLayouts ? dto.bookerLayouts : undefined,
    confirmationPolicy: dto.requiresConfirmation
      ? {
          type: dto.requiresConfirmationThreshold ? "time" : "always",
          ...(dto.requiresConfirmationThreshold && {
            noticeThreshold: {
              unit: dto.requiresConfirmationThreshold.unit,
              count: dto.requiresConfirmationThreshold.time,
            },
          }),
          blockUnconfirmedBookingsInBooker: dto.requiresConfirmationWillBlockSlot,
          disabled: false,
        }
      : undefined,
    color: dto.eventTypeColor
      ? {
          lightThemeHex: dto.eventTypeColor.lightEventTypeColor,
          darkThemeHex: dto.eventTypeColor.darkEventTypeColor,
        }
      : undefined,
    seats: dto.seatsPerTimeSlot
      ? {
          seatsPerTimeSlot: dto.seatsPerTimeSlot,
          showAttendeeInfo: dto.seatsShowAttendees,
          showAvailabilityCount: dto.seatsShowAvailabilityCount,
        }
      : { disabled: true },
  };
}

/** Cal's EventTypeOutput_2024_06_14. */
function toEventTypeOutput(dto: EventTypeDto, owner: OwnerRow, origin: string) {
  return {
    id: dto.id,
    ownerId: owner.id,
    lengthInMinutes: dto.length,
    ...(dto.multipleDuration ? { lengthInMinutesOptions: dto.multipleDuration } : {}),
    title: dto.title,
    slug: dto.slug,
    description: dto.description ?? "",
    locations: dto.locations.map(fromLocation),
    bookingFields: bookingFieldsOutput(dto),
    disableGuests: dto.bookingFields.some((field) => field.name === "guests" && field.hidden),
    slotInterval: dto.slotInterval,
    minimumBookingNotice: dto.minimumBookingNotice,
    beforeEventBuffer: dto.beforeEventBuffer,
    afterEventBuffer: dto.afterEventBuffer,
    recurrence: dto.recurringEvent
      ? {
          frequency: FREQUENCIES[dto.recurringEvent.freq],
          interval: dto.recurringEvent.interval,
          occurrences: dto.recurringEvent.count,
        }
      : null,
    metadata: {},
    price: 0,
    currency: "usd",
    lockTimeZoneToggleOnBookingPage: dto.lockTimeZoneToggleOnBookingPage,
    seatsPerTimeSlot: dto.seatsPerTimeSlot,
    forwardParamsSuccessRedirect: dto.forwardParamsSuccessRedirect,
    successRedirectUrl: dto.successRedirectUrl,
    isInstantEvent: false,
    seatsShowAvailabilityCount: dto.seatsShowAvailabilityCount,
    scheduleId: dto.scheduleId,
    onlyShowFirstAvailableSlot: dto.onlyShowFirstAvailableSlot,
    requiresBookerEmailVerification: dto.requiresBookerEmailVerification,
    hideCalendarNotes: dto.hideCalendarNotes,
    offsetStart: dto.offsetStart,
    ...(dto.eventName ? { customName: dto.eventName } : {}),
    hideCalendarEventDetails: dto.hideCalendarEventDetails,
    hideOrganizerEmail: dto.hideOrganizerEmail,
    hidden: dto.hidden,
    bookingRequiresAuthentication: false,
    disableCancelling: { disabled: dto.disableCancelling },
    disableRescheduling: {
      disabled: dto.disableRescheduling,
      ...(dto.minimumRescheduleNotice ? { minutesBefore: dto.minimumRescheduleNotice } : {}),
    },
    interfaceLanguage: dto.interfaceLanguage,
    ...Object.fromEntries(Object.entries(optionalOutputs(dto)).filter(([, value]) => value !== undefined)),
    users: [
      {
        id: owner.id,
        name: owner.name,
        username: owner.username,
        avatarUrl: owner.avatarUrl,
        weekStart: owner.weekStart,
        brandColor: owner.brandColor,
        darkBrandColor: owner.darkBrandColor,
        metadata: owner.metadata && typeof owner.metadata === "object" ? owner.metadata : {},
      },
    ],
    bookingUrl: `${origin}/${owner.username}/${dto.slug}`,
  };
}

export type { EventTypeApiInput };
export {
  EVENT_TYPES_API_VERSION,
  createEventTypeInputSchema,
  updateEventTypeInputSchema,
  applyEventTypeInput,
  toEventTypeOutput,
};

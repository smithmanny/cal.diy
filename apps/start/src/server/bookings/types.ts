import { z } from "zod";
import type { BookingField, BookingResponseValue } from "~/lib/booking-fields";

const MAX_RESPONSES_BYTES = 64 * 1024;

export const slotsQuerySchema = z.object({
  username: z.string().min(1).max(100),
  slug: z.string().min(1).max(200),
  from: z.string().datetime(),
  to: z.string().datetime(),
  timeZone: z.string().min(1).max(100),
  rescheduleUid: z.string().max(100).optional(),
});

export const createBookingSchema = z.object({
  username: z.string().min(1).max(100),
  slug: z.string().min(1).max(200),
  start: z.string().datetime(),
  timeZone: z.string().min(1).max(100),
  locale: z.string().max(20).default("en"),
  /** Answers keyed by booking field name, in Cal's format; checked against the event's questions. */
  responses: z.record(z.unknown()).refine((value) => JSON.stringify(value).length <= MAX_RESPONSES_BYTES, {
    message: "something_went_wrong",
  }),
  rescheduleUid: z.string().max(100).optional(),
});

export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export type PublicEventLocation = { type: string; address?: string };

/** An answer shown back on the booking page, labelled the way the booker saw the question. */
export type BookingAnswerDto = {
  name: string;
  type: BookingField["type"];
  label: string | null;
  defaultLabel: string | null;
  value: BookingResponseValue;
};

/** How the host's public pages look; see ThemeScope. */
export type AppearanceDto = {
  theme: "light" | "dark" | null;
  brandColor: string | null;
  darkBrandColor: string | null;
  hideBranding: boolean;
};

export type PublicHostDto = {
  name: string | null;
  username: string;
  avatarUrl: string | null;
  /** 0 = Sunday; the booker's calendar starts its weeks here, as the host chose. */
  weekStartDay: number;
  allowSEOIndexing: boolean;
  appearance: AppearanceDto;
};

export type PublicEventDto = {
  host: PublicHostDto;
  eventType: {
    title: string;
    slug: string;
    description: string | null;
    length: number;
    requiresConfirmation: boolean;
    locations: PublicEventLocation[];
    bookingFields: BookingField[];
  };
};

export type BookingDetailsDto = {
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  location: string | null;
  cancellationReason: string | null;
  rescheduled: boolean;
  notes: string | null;
  /** Whether the booker may still cancel or move it, per the event type's settings. */
  canCancel: boolean;
  canReschedule: boolean;
  answers: BookingAnswerDto[];
  host: { name: string | null; email: string; username: string | null; appearance: AppearanceDto } | null;
  eventType: { title: string; slug: string; length: number } | null;
  attendees: { name: string; email: string; timeZone: string }[];
};

/**
 * What the booker shows for a day the host is away. For "away" days `reason` is a translation key;
 * for "holiday" days it is the holiday's name.
 */
export type OutOfOfficeDayDto = {
  kind: "away" | "holiday";
  displayName: string | null;
  reason: string | null;
  emoji: string | null;
  notes: string | null;
  toUser: { username: string; displayName: string | null } | null;
};

export type SlotsDto = {
  slots: string[];
  /** Keyed by YYYY-MM-DD (UTC), like Cal. */
  outOfOffice: Record<string, OutOfOfficeDayDto>;
};

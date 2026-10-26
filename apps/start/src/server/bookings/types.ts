import { z } from "zod";

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
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  notes: z.string().max(5000).optional(),
  locationType: z.string().max(100).optional(),
  attendeePhone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s().-]{6,20}$/)
    .optional(),
  rescheduleUid: z.string().max(100).optional(),
});

export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export type PublicEventLocation = { type: string; address?: string };

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

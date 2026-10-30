import { z } from "zod";

/** The triggers this app emits today; the rest of Cal's enum is ported with their features. */
export const SUPPORTED_TRIGGERS = [
  "BOOKING_CREATED",
  "BOOKING_REQUESTED",
  "BOOKING_RESCHEDULED",
  "BOOKING_CANCELLED",
  "BOOKING_REJECTED",
  "BOOKING_NO_SHOW_UPDATED",
] as const;

export type SupportedTrigger = (typeof SUPPORTED_TRIGGERS)[number];

export const webhookInputSchema = z.object({
  subscriberUrl: z
    .string()
    .trim()
    .url()
    .max(2000)
    .refine((url) => /^https?:\/\//i.test(url)),
  eventTriggers: z.array(z.enum(SUPPORTED_TRIGGERS)).min(1),
  active: z.boolean(),
  /** Omit to keep the current secret; empty string removes it. */
  secret: z.string().max(500).optional(),
  payloadTemplate: z.string().max(10000).nullable(),
});

export type WebhookInput = z.infer<typeof webhookInputSchema>;

export type WebhookDto = {
  id: string;
  subscriberUrl: string;
  eventTriggers: SupportedTrigger[];
  active: boolean;
  hasSecret: boolean;
  payloadTemplate: string | null;
};

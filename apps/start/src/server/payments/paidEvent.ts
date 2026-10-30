import type { JsonValue } from "@calcom/db/ids";
import { z } from "zod";
import { parseMetadata } from "../metadata";

/** Cal's refund policies (RefundPolicy in packages/lib/payment/types.ts). */
const REFUND_POLICIES = ["never", "always", "days"] as const;

/**
 * What a paid event charges, as Cal keeps it in EventType.metadata.apps.stripe. `price` is in the
 * currency's smallest unit (cents), as Stripe takes it.
 */
const eventPaymentSchema = z
  .object({
    price: z.number().int().min(1).max(99_999_999),
    currency: z.string().regex(/^[a-z]{3}$/),
    refundPolicy: z.enum(REFUND_POLICIES),
    refundDaysCount: z.number().int().min(1).max(365).nullable(),
    refundCountCalendarDays: z.boolean(),
  })
  .refine((payment) => payment.refundPolicy !== "days" || payment.refundDaysCount !== null, {
    path: ["refundDaysCount"],
  });

type EventPayment = z.infer<typeof eventPaymentSchema>;

const storedSchema = z.object({
  enabled: z.boolean().optional(),
  price: z.number(),
  currency: z.string(),
  paymentOption: z.string().optional(),
  refundPolicy: z.enum(REFUND_POLICIES).optional(),
  refundDaysCount: z.number().optional(),
  refundCountCalendarDays: z.boolean().optional(),
});

function appsOf(metadata: unknown): { [key: string]: JsonValue } {
  const apps = parseMetadata(metadata).apps;
  return apps && typeof apps === "object" && !Array.isArray(apps) ? { ...apps } : {};
}

function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() - 1);
    const weekday = result.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining--;
  }
  return result;
}

/** The event's price when Stripe is on for it with a price, as Cal's getPaymentAppData reads it. */
export function parseEventPayment(metadata: unknown): EventPayment | null {
  const stored = storedSchema.safeParse(appsOf(metadata).stripe);
  if (!stored.success || !stored.data.enabled || stored.data.price <= 0) return null;
  // Only charging at booking is supported; Cal's HOLD (card on file) is not.
  if (stored.data.paymentOption && stored.data.paymentOption !== "ON_BOOKING") return null;
  return {
    price: Math.round(stored.data.price),
    currency: stored.data.currency.toLowerCase(),
    refundPolicy: stored.data.refundPolicy ?? "never",
    refundDaysCount: stored.data.refundDaysCount ?? null,
    refundCountCalendarDays: stored.data.refundCountCalendarDays ?? true,
  };
}

/** The metadata.apps value with Stripe set to `payment`, or switched off (keeping its settings) for null. */
export function withEventPayment(
  metadata: unknown,
  payment: EventPayment | null
): { [key: string]: JsonValue } {
  const apps = appsOf(metadata);
  const current =
    apps.stripe && typeof apps.stripe === "object" && !Array.isArray(apps.stripe) ? apps.stripe : {};
  apps.stripe = payment
    ? {
        ...current,
        enabled: true,
        price: payment.price,
        currency: payment.currency,
        paymentOption: "ON_BOOKING",
        refundPolicy: payment.refundPolicy,
        refundCountCalendarDays: payment.refundCountCalendarDays,
        ...(payment.refundDaysCount !== null && { refundDaysCount: payment.refundDaysCount }),
      }
    : { ...current, enabled: false };
  return apps;
}

/**
 * Cal's processPaymentRefund: never, always, or only until a number of (calendar or business)
 * days before the booking starts.
 */
export function isRefundDue(payment: EventPayment, startTime: Date, now: Date): boolean {
  if (payment.refundPolicy === "never") return false;
  if (payment.refundPolicy === "always" || !payment.refundDaysCount) return true;
  const deadline = payment.refundCountCalendarDays
    ? new Date(startTime.getTime() - payment.refundDaysCount * 86_400_000)
    : subtractBusinessDays(startTime, payment.refundDaysCount);
  return now <= deadline;
}

export { eventPaymentSchema };
export type { EventPayment };

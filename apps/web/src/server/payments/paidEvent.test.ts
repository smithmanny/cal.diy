import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney } from "~/lib/money";
import { isRefundDue, parseEventPayment, withEventPayment } from "./paidEvent";
import { encodeForm } from "./stripe/StripeClient";
import { signStripePayload, verifyStripeSignature } from "./stripe/signature";

const payment = {
  price: 2500,
  currency: "eur",
  refundPolicy: "days" as const,
  refundDaysCount: 2,
  refundCountCalendarDays: true,
};

describe("paid event settings", () => {
  it("round-trips through Cal's metadata.apps.stripe, keeping other apps", () => {
    const apps = withEventPayment({ apps: { giphy: { enabled: true } } }, payment);
    expect(apps).toEqual({
      giphy: { enabled: true },
      stripe: {
        enabled: true,
        price: 2500,
        currency: "eur",
        paymentOption: "ON_BOOKING",
        refundPolicy: "days",
        refundDaysCount: 2,
        refundCountCalendarDays: true,
      },
    });
    expect(parseEventPayment({ apps })).toEqual(payment);
    const off = withEventPayment({ apps }, null);
    expect(off.stripe).toMatchObject({ enabled: false, price: 2500 });
    expect(parseEventPayment({ apps: off })).toBeNull();
  });

  it("reads Cal's own rows leniently and skips what isn't supported", () => {
    expect(parseEventPayment({ apps: { stripe: { enabled: true, price: 1000, currency: "USD" } } })).toEqual({
      price: 1000,
      currency: "usd",
      refundPolicy: "never",
      refundDaysCount: null,
      refundCountCalendarDays: true,
    });
    expect(parseEventPayment({ apps: { stripe: { enabled: true, price: 0, currency: "usd" } } })).toBeNull();
    expect(
      parseEventPayment({
        apps: { stripe: { enabled: true, price: 1000, currency: "usd", paymentOption: "HOLD" } },
      })
    ).toBeNull();
    expect(parseEventPayment(null)).toBeNull();
  });

  it("refunds by Cal's policies, counting calendar or business days", () => {
    const start = new Date("2030-01-07T10:00:00Z"); // a Monday
    expect(isRefundDue({ ...payment, refundPolicy: "never" }, start, new Date("2029-01-01"))).toBe(false);
    expect(isRefundDue({ ...payment, refundPolicy: "always" }, start, new Date("2030-01-07T09:00:00Z"))).toBe(
      true
    );
    expect(isRefundDue(payment, start, new Date("2030-01-05T09:00:00Z"))).toBe(true);
    expect(isRefundDue(payment, start, new Date("2030-01-05T11:00:00Z"))).toBe(false);
    // Two business days before a Monday is the Thursday before.
    const business = { ...payment, refundCountCalendarDays: false };
    expect(isRefundDue(business, start, new Date("2030-01-03T09:00:00Z"))).toBe(true);
    expect(isRefundDue(business, start, new Date("2030-01-04T09:00:00Z"))).toBe(false);
  });
});

describe("money", () => {
  it("formats and parses the currency's smallest unit", () => {
    expect(formatMoney(1550, "usd", "en")).toBe("$15.50");
    expect(formatMoney(1500, "jpy", "en")).toBe("¥1,500");
    expect(parseMoney("15.5", "usd")).toBe(1550);
    expect(parseMoney("15,5", "eur")).toBe(1550);
    expect(parseMoney("1500", "jpy")).toBe(1500);
    expect(parseMoney("-1", "usd")).toBeNull();
    expect(parseMoney("abc", "usd")).toBeNull();
  });
});

describe("Stripe helpers", () => {
  it("verifies webhook signatures, rejecting tampering, other secrets and old deliveries", async () => {
    const now = Date.now();
    const header = await signStripePayload('{"a":1}', "whsec_x", now);
    expect(await verifyStripeSignature('{"a":1}', header, "whsec_x", now)).toBe(true);
    expect(await verifyStripeSignature('{"a":2}', header, "whsec_x", now)).toBe(false);
    expect(await verifyStripeSignature('{"a":1}', header, "whsec_y", now)).toBe(false);
    expect(await verifyStripeSignature('{"a":1}', header, "whsec_x", now + 10 * 60_000)).toBe(false);
    expect(await verifyStripeSignature('{"a":1}', null, "whsec_x", now)).toBe(false);
    expect(await verifyStripeSignature('{"a":1}', "t=1,v1=", "whsec_x", now)).toBe(false);
  });

  it("form-encodes nested parameters the way Stripe reads them", () => {
    expect(encodeForm({ mode: "payment", line_items: { 0: { quantity: 1 } }, skip: undefined })).toEqual([
      "mode=payment",
      `${encodeURIComponent("line_items[0][quantity]")}=1`,
    ]);
  });
});

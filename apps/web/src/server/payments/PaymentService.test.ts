import type { Database } from "@calcom/db/database";
import { booking, eventType, payment, user } from "@calcom/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { CredentialRepository } from "../apps/CredentialRepository";
import { CredentialVault } from "../apps/CredentialVault";
import { BookingRepository } from "../bookings/BookingRepository";
import { BookingService } from "../bookings/BookingService";
import type { BookingEvent } from "../bookings/events";
import { EventTypeRepository } from "../event-types/EventTypeRepository";
import { HolidayRepository } from "../holidays/HolidayRepository";
import { HolidayService } from "../holidays/HolidayService";
import { OutOfOfficeRepository } from "../out-of-office/OutOfOfficeRepository";
import { ScheduleRepository } from "../schedules/ScheduleRepository";
import { ScheduleService } from "../schedules/ScheduleService";
import { DEFAULT_WEEKLY_HOURS } from "../schedules/scheduleMapper";
import { TravelScheduleRepository } from "../users/TravelScheduleRepository";
import { UserRepository } from "../users/UserRepository";
import { PaymentRepository } from "./PaymentRepository";
import { PaymentService } from "./PaymentService";
import { withEventPayment } from "./paidEvent";
import { createFakeStripeState, type FakeStripeState, fakeStripeFetch } from "./stripe/fakeStripe";
import { StripeClient } from "./stripe/StripeClient";
import { signStripePayload } from "./stripe/signature";

const KEY = "0123456789abcdef0123456789abcdef";
const SECRET = "whsec_unit";
let db: Database;
let stripe: FakeStripeState;
let payments: PaymentService;
let bookings: BookingService;
let events: BookingEvent[];
let pending: Promise<unknown>[];
let hostId: number;

const now = () => new Date("2030-01-01T09:00:00Z");

async function book(start = "2030-01-07T12:00:00.000Z") {
  return bookings.create({
    username: "host",
    slug: "paid",
    start,
    timeZone: "UTC",
    locale: "en",
    responses: { name: "Greta", email: "greta@example.com" },
  });
}

/** The booker pays on the fake Checkout page, whose webhook reaches the service. */
async function pay(paymentUid: string) {
  const [row] = await db
    .select({ externalId: payment.externalId })
    .from(payment)
    .where(eq(payment.uid, paymentUid));
  const fetchImpl = fakeStripeFetch(stripe, "https://stripe.test", (async (
    _url: RequestInfo | URL,
    init?: RequestInit
  ) => {
    await payments.handleWebhook(String(init?.body), new Headers(init?.headers).get("Stripe-Signature"));
    return new Response("{}");
  }) as typeof fetch);
  await fetchImpl(`https://stripe.test/checkout/${row.externalId}/pay`, { method: "POST" });
  await Promise.all(pending);
}

beforeEach(async () => {
  db = await createTestDb();
  events = [];
  pending = [];
  stripe = createFakeStripeState("https://cal.test/api/integrations/stripepayment/webhook", SECRET);
  const client = new StripeClient(
    {
      secretKey: "sk_test_platform",
      clientId: "ca_test",
      apiUrl: "https://stripe.test/v1",
      connectUrl: "https://stripe.test/connect",
    },
    fakeStripeFetch(stripe)
  );
  const bookingRepo = new BookingRepository(db);
  payments = new PaymentService({
    repo: new PaymentRepository(db),
    credentials: new CredentialRepository(db),
    vault: new CredentialVault(KEY),
    stripe: client,
    webhookSecret: SECRET,
    publicUrl: "https://cal.test",
    markBookingPaid: (uid, status) => bookings.markPaid(uid, status),
    now,
  });
  const userRepo = new UserRepository(db);
  const scheduleRepo = new ScheduleRepository(db);
  [{ id: hostId }] = await db
    .insert(user)
    .values({ email: "host@example.com", username: "host", name: "Hana", timeZone: "UTC" })
    .returning({ id: user.id });
  await new ScheduleService({ scheduleRepo, userRepo }).create(hostId, {
    name: "Work",
    timeZone: "UTC",
    weeklyHours: DEFAULT_WEEKLY_HOURS,
    dateOverrides: [],
  });
  await db.insert(eventType).values({
    userId: hostId,
    title: "Paid intro",
    slug: "paid",
    length: 30,
    metadata: {
      apps: withEventPayment(null, {
        price: 2500,
        currency: "usd",
        refundPolicy: "days",
        refundDaysCount: 2,
        refundCountCalendarDays: true,
      }),
    },
  });
  await payments.connect(hostId, await client.connect("ac_fake"));
  bookings = new BookingService({
    userRepo,
    eventTypeRepo: new EventTypeRepository(db),
    scheduleRepo,
    bookingRepo,
    travelScheduleRepo: new TravelScheduleRepository(db),
    oooRepo: new OutOfOfficeRepository(db),
    holidayService: new HolidayService({ repo: new HolidayRepository(db), fetchHolidays: null }),
    listeners: [async (event) => void events.push(event), (event) => payments.onBookingEvent(event)],
    runInBackground: (promise) => void pending.push(promise),
    payments,
    now,
  });
});

describe("paid bookings", () => {
  it("hold the slot as PENDING with a Checkout session until the webhook confirms them", async () => {
    const created = await book();
    expect(created.status).toBe("PENDING");
    expect(created.paymentUid).toEqual(expect.any(String));
    await Promise.all(pending);
    expect(events).toEqual([]);

    const [session] = stripe.sessions.values();
    expect(session).toMatchObject({
      amount_total: 2500,
      currency: "usd",
      customer_email: "greta@example.com",
    });
    expect(session.account).toMatch(/^acct_fake_/);
    expect(session.success_url).toBe(`https://cal.test/payment/${created.paymentUid}?checkout=success`);
    expect(await payments.paymentPage(created.paymentUid ?? "")).toMatchObject({ paid: false, amount: 2500 });

    await pay(created.paymentUid ?? "");
    const [stored] = await db.select({ status: booking.status, paid: booking.paid }).from(booking);
    expect(stored).toEqual({ status: "ACCEPTED", paid: true });
    expect(events.map((event) => event.type)).toEqual(["BOOKING_CREATED"]);
  });

  it("ignores unsigned and repeated webhooks", async () => {
    const created = await book();
    const [session] = stripe.sessions.values();
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { ...session, payment_status: "paid", payment_intent: "pi_forged" } },
    });
    await expect(payments.handleWebhook(payload, "t=1,v1=00")).rejects.toMatchObject({
      code: "invalid_signature",
    });
    await expect(
      payments.handleWebhook(payload, await signStripePayload(payload, "whsec_other"))
    ).rejects.toThrow();

    await pay(created.paymentUid ?? "");
    await payments.handleWebhook(payload, await signStripePayload(payload, SECRET));
    await Promise.all(pending);
    expect(events.filter((event) => event.type === "BOOKING_CREATED")).toHaveLength(1);
  });

  it("asks Stripe when the booker is back before the webhook", async () => {
    const created = await book();
    stripe.webhookUrl = null;
    await pay(created.paymentUid ?? "");
    expect((await payments.paymentPage(created.paymentUid ?? "")).paid).toBe(false);
    expect((await payments.paymentPage(created.paymentUid ?? "", true)).paid).toBe(true);
  });

  it("refunds a cancellation inside the refund window, and not after it", async () => {
    const early = await book("2030-01-07T12:00:00.000Z");
    await pay(early.paymentUid ?? "");
    await bookings.cancel(early.uid, null, null);
    await Promise.all(pending);
    expect(stripe.refunds).toEqual([
      { account: expect.stringMatching(/^acct_fake_/), payment_intent: expect.stringMatching(/^pi_test_/) },
    ]);
    expect((await db.select({ refunded: payment.refunded }).from(payment))[0].refunded).toBe(true);

    // Starts a day after "now": inside the two days before it, so no refund.
    const late = await book("2030-01-02T12:00:00.000Z");
    await pay(late.paymentUid ?? "");
    await bookings.cancel(late.uid, null, null);
    await Promise.all(pending);
    expect(stripe.refunds).toHaveLength(1);
  });

  it("always refunds when the host rejects a paid request", async () => {
    await db.update(eventType).set({ requiresConfirmation: true });
    const created = await book("2030-01-02T12:00:00.000Z");
    await pay(created.paymentUid ?? "");
    const [stored] = await db.select({ status: booking.status, paid: booking.paid }).from(booking);
    expect(stored).toEqual({ status: "PENDING", paid: true });
    await bookings.decide(hostId, created.uid, false, null);
    await Promise.all(pending);
    expect(stripe.refunds).toHaveLength(1);
  });

  it("can't be booked without Stripe, and releases the slot when Checkout fails", async () => {
    const withoutStripe = new BookingService({ ...bookingsDeps(), payments: undefined });
    await expect(withoutStripe.create(bookingInput())).rejects.toMatchObject({
      code: "payment_not_created_error",
    });

    stripe.sessions.set = () => {
      throw new Error("Stripe is down");
    };
    await expect(book()).rejects.toMatchObject({ code: "payment_not_created_error" });
    expect((await db.select({ status: booking.status }).from(booking))[0].status).toBe("CANCELLED");
  });
});

function bookingInput() {
  return {
    username: "host",
    slug: "paid",
    start: "2030-01-07T12:00:00.000Z",
    timeZone: "UTC",
    locale: "en",
    responses: { name: "Greta", email: "greta@example.com" },
  };
}

function bookingsDeps(): ConstructorParameters<typeof BookingService>[0] {
  return {
    userRepo: new UserRepository(db),
    eventTypeRepo: new EventTypeRepository(db),
    scheduleRepo: new ScheduleRepository(db),
    bookingRepo: new BookingRepository(db),
    travelScheduleRepo: new TravelScheduleRepository(db),
    oooRepo: new OutOfOfficeRepository(db),
    holidayService: new HolidayService({ repo: new HolidayRepository(db), fetchHolidays: null }),
    now,
  };
}

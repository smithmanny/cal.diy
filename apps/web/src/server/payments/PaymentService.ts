import "@tanstack/react-start/server-only";

import type { JsonValue } from "@calcom/db/ids";
import type { CredentialOwner, CredentialRepository } from "../apps/CredentialRepository";
import type { CredentialVault } from "../apps/CredentialVault";
import type { BookingEvent } from "../bookings/events";
import { AppError } from "../errors";
import { parseMetadata } from "../metadata";
import type { PaymentRepository } from "./PaymentRepository";
import { type EventPayment, isRefundDue, parseEventPayment } from "./paidEvent";
import type { CheckoutSession, StripeClient, StripeConnectKey } from "./stripe/StripeClient";
import { verifyStripeSignature } from "./stripe/signature";

const STRIPE_PAYMENT_TYPE = "stripe_payment";

type BookingStatusAfterPayment = "ACCEPTED" | "PENDING";

type Deps = {
  repo: PaymentRepository;
  credentials: CredentialRepository;
  vault: CredentialVault;
  stripe: StripeClient;
  /** STRIPE_WEBHOOK_SECRET: signs the Connect webhook's deliveries. */
  webhookSecret: string;
  publicUrl: string;
  /** Confirms a booking once paid; a callback because the booking service also starts payments. */
  markBookingPaid: (bookingUid: string, status: BookingStatusAfterPayment) => Promise<void>;
  now?: () => Date;
};

/** What Payment.data holds besides Stripe's ids, so the payment page and webhook need no other lookup. */
type PaymentData = {
  stripeAccount: string;
  checkoutUrl: string | null;
  expiresAt: number;
  statusAfterPayment: BookingStatusAfterPayment;
  paymentIntent?: string | null;
};

type PaymentPageDto = {
  uid: string;
  amount: number;
  currency: string;
  paid: boolean;
  refunded: boolean;
  /** The booking was cancelled before it was paid for. */
  cancelled: boolean;
  bookingUid: string;
  title: string;
  eventTitle: string | null;
  startTime: Date;
  endTime: Date;
  hostName: string | null;
  hostTimeZone: string | null;
};

type StartPaymentInput = {
  bookingUid: string;
  hostId: number;
  /** A team's event type is paid into the team's Stripe account when the team connected one. */
  teamId?: number | null;
  productName: string;
  bookerEmail: string;
  payment: EventPayment;
  statusAfterPayment: BookingStatusAfterPayment;
};

function paymentData(value: unknown): PaymentData | null {
  const data = parseMetadata(value);
  if (typeof data.stripeAccount !== "string" || typeof data.expiresAt !== "number") return null;
  return {
    stripeAccount: data.stripeAccount,
    checkoutUrl: typeof data.checkoutUrl === "string" ? data.checkoutUrl : null,
    expiresAt: data.expiresAt,
    statusAfterPayment: data.statusAfterPayment === "PENDING" ? "PENDING" : "ACCEPTED",
    paymentIntent: typeof data.paymentIntent === "string" ? data.paymentIntent : null,
  };
}

/**
 * Cal's Stripe app: hosts connect their Stripe account, paid events take the booker through
 * Stripe Checkout, the webhook confirms the booking, and cancellations refund by the event's policy.
 */
class PaymentService {
  constructor(private readonly deps: Deps) {}

  async connect(owner: CredentialOwner, key: StripeConnectKey): Promise<void> {
    // One Stripe account per host or team, as Cal's payment apps allow.
    const existing =
      "teamId" in owner
        ? await this.deps.credentials.findByTeamId(owner.teamId, [STRIPE_PAYMENT_TYPE])
        : await this.deps.credentials.findByUserId(owner.userId, [STRIPE_PAYMENT_TYPE]);
    for (const row of existing) await this.deps.credentials.delete(row.id);
    await this.deps.credentials.create(owner, STRIPE_PAYMENT_TYPE, await this.deps.vault.seal(key));
  }

  /** Creates the Payment and its checkout session; the booker pays at /payment/<uid>. */
  async startPayment(input: StartPaymentInput): Promise<string> {
    const account = await this.hostAccount(input.hostId, input.teamId ?? null);
    if (!account) throw new AppError("payment_not_created_error", 400);
    const uid = crypto.randomUUID();
    const session = await this.checkout(uid, account, input);
    await this.deps.repo.create({
      uid,
      bookingUid: input.bookingUid,
      amount: input.payment.price,
      currency: input.payment.currency,
      externalId: session.id,
      data: this.storedData(session, account, input.statusAfterPayment),
    });
    return uid;
  }

  async paymentPage(uid: string, returnedFromCheckout = false): Promise<PaymentPageDto> {
    let found = await this.deps.repo.findByUidIncludeBooking(uid);
    if (!found) throw new AppError("not_found", 404);
    // The booker is back from Checkout; if the webhook hasn't arrived yet, ask Stripe directly.
    if (returnedFromCheckout && !found.success) {
      await this.syncFromStripe(found.externalId, found.data);
      found = (await this.deps.repo.findByUidIncludeBooking(uid)) ?? found;
    }
    return {
      uid: found.uid,
      amount: found.amount,
      currency: found.currency,
      paid: found.success,
      refunded: found.refunded,
      cancelled: !found.success && ["CANCELLED", "REJECTED"].includes(found.booking.status),
      bookingUid: found.booking.uid,
      title: found.booking.title,
      eventTitle: found.eventTypeTitle,
      startTime: found.booking.startTime,
      endTime: found.booking.endTime,
      hostName: found.hostName,
      hostTimeZone: found.hostTimeZone,
    };
  }

  /** Where to pay: the open checkout session, or a new one when it expired (after 24 hours). */
  async checkoutUrl(uid: string): Promise<string> {
    const found = await this.deps.repo.findByUidIncludeBooking(uid);
    const data = paymentData(found?.data);
    if (!found || !data || found.success || ["CANCELLED", "REJECTED"].includes(found.booking.status))
      throw new AppError("not_found", 404);
    const now = this.deps.now?.() ?? new Date();
    if (data.checkoutUrl && data.expiresAt * 1000 > now.getTime() + 60_000) return data.checkoutUrl;
    const session = await this.checkout(uid, data.stripeAccount, {
      productName: found.eventTypeTitle ?? found.booking.title,
      payment: { price: found.amount, currency: found.currency },
      bookingUid: found.booking.uid,
      bookerEmail: "",
    });
    await this.deps.repo.updateCheckout(
      found.id,
      session.id,
      this.storedData(session, data.stripeAccount, data.statusAfterPayment)
    );
    if (!session.url) throw new Error(`Checkout session ${session.id} has no URL`);
    return session.url;
  }

  /** Stripe's webhook: only signed events count, and each payment confirms its booking once. */
  async handleWebhook(payload: string, signature: string | null): Promise<void> {
    // The real clock: Stripe signs with its own, and `now` may be a test's fixed booking time.
    if (!(await verifyStripeSignature(payload, signature, this.deps.webhookSecret, Date.now())))
      throw new AppError("invalid_signature", 400);
    const event = JSON.parse(payload) as { type: string; data: { object: CheckoutSession } };
    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded"
    )
      return;
    const session = event.data.object;
    if (session.payment_status === "paid") await this.confirm(session.id, session.payment_intent);
  }

  /** Refunds by the event's policy when a paid booking is cancelled, and always when the host rejects it. */
  async onBookingEvent(event: BookingEvent): Promise<void> {
    if (event.type === "BOOKING_REJECTED") {
      await this.refund(event.booking.uid, true);
      return;
    }
    if (event.type === "BOOKING_RESCHEDULED" && event.rescheduledFrom && !event.seat) {
      await this.deps.repo.moveToBooking(event.rescheduledFrom.uid, event.booking.uid);
      return;
    }
    // A seat leaving or the host asking for a new time doesn't end what was paid for.
    if (event.type === "BOOKING_CANCELLED" && !event.seat && !event.rescheduleRequested)
      await this.refund(event.booking.uid, false);
  }

  private async confirm(sessionId: string, paymentIntent: string | null): Promise<void> {
    const found = await this.deps.repo.findByExternalIdIncludeBooking(sessionId);
    const data = paymentData(found?.data);
    if (!found || !data) return;
    const updated = await this.deps.repo.markSuccess(found.id, { ...data, paymentIntent });
    if (updated) await this.deps.markBookingPaid(found.bookingUid, data.statusAfterPayment);
  }

  private async syncFromStripe(sessionId: string, stored: unknown): Promise<void> {
    const data = paymentData(stored);
    if (!data) return;
    try {
      const session = await this.deps.stripe.retrieveCheckoutSession(data.stripeAccount, sessionId);
      if (session.payment_status === "paid") await this.confirm(session.id, session.payment_intent);
    } catch (error) {
      // The webhook will still confirm it.
      console.error(`Checking checkout session ${sessionId} failed`, error);
    }
  }

  private async refund(bookingUid: string, always: boolean): Promise<void> {
    const now = this.deps.now?.() ?? new Date();
    for (const found of await this.deps.repo.findRefundable(bookingUid)) {
      const policy = parseEventPayment(found.eventTypeMetadata);
      if (!always && !(policy && isRefundDue(policy, found.startTime, now))) continue;
      const data = paymentData(found.data);
      if (!data?.paymentIntent) continue;
      await this.deps.stripe.refund(data.stripeAccount, data.paymentIntent);
      await this.deps.repo.markRefunded(found.id);
    }
  }

  private async hostAccount(hostId: number, teamId: number | null): Promise<string | null> {
    const [teamRow] = teamId ? await this.deps.credentials.findByTeamId(teamId, [STRIPE_PAYMENT_TYPE]) : [];
    const row = teamRow ?? (await this.deps.credentials.findByUserId(hostId, [STRIPE_PAYMENT_TYPE]))[0];
    if (!row) return null;
    const key = (await this.deps.vault.open(row)) as Partial<StripeConnectKey> | null;
    return key?.stripe_user_id ?? null;
  }

  private checkout(
    uid: string,
    account: string,
    input: Pick<StartPaymentInput, "productName" | "bookingUid" | "bookerEmail"> & {
      payment: Pick<EventPayment, "price" | "currency">;
    }
  ): Promise<CheckoutSession> {
    const pageUrl = `${this.deps.publicUrl}/payment/${uid}`;
    return this.deps.stripe.createCheckoutSession({
      account,
      amount: input.payment.price,
      currency: input.payment.currency,
      productName: input.productName,
      customerEmail: input.bookerEmail,
      successUrl: `${pageUrl}?checkout=success`,
      cancelUrl: pageUrl,
      metadata: { bookingUid: input.bookingUid, paymentUid: uid },
    });
  }

  private storedData(
    session: CheckoutSession,
    account: string,
    statusAfterPayment: BookingStatusAfterPayment
  ): { [key: string]: JsonValue } {
    return {
      stripeAccount: account,
      checkoutUrl: session.url,
      expiresAt: session.expires_at,
      statusAfterPayment,
    };
  }
}

export { PaymentService, STRIPE_PAYMENT_TYPE };
export type { BookingStatusAfterPayment, PaymentPageDto };

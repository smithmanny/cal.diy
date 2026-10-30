import "@tanstack/react-start/server-only";
import { formatLongDate, formatTime } from "~/lib/date-utils";
import { createT, type Messages } from "~/lib/i18n";
import type { BookingEvent } from "../bookings/events";
import { AppError } from "../errors";
import type { PushRepository } from "./PushRepository";
import { buildPushRequest, type PushSubscriptionJson, type VapidKeys } from "./webPush";

type Config = {
  vapid: VapidKeys & { subject: string };
  publicUrl: string;
  /** Development lets browser tests use a fake push service on localhost. */
  allowInsecureEndpoints: boolean;
  loadMessages: (locale: string, keys: readonly string[]) => Promise<Messages>;
  fetchImpl?: typeof fetch;
};

const MESSAGE_KEYS = ["new_event_scheduled", "event_awaiting_approval"];

/** Cal's web push notifications; the organizer's browsers hear about new bookings. */
export class PushService {
  constructor(
    private readonly repo: Pick<PushRepository, "findByUserId" | "save" | "removeByEndpoint" | "removeById">,
    private readonly config: Config
  ) {}

  get publicKey(): string {
    return this.config.vapid.publicKey;
  }

  async subscribe(userId: number, subscription: PushSubscriptionJson): Promise<void> {
    const url = URL.canParse(subscription.endpoint) ? new URL(subscription.endpoint) : null;
    const local = url?.hostname === "localhost" || url?.hostname === "127.0.0.1";
    // Push services are public HTTPS endpoints; anything else would let the server be pointed inward.
    if (!url || !(url.protocol === "https:" || (this.config.allowInsecureEndpoints && local)))
      throw new AppError("something_went_wrong", 400);
    await this.repo.save(userId, subscription);
  }

  async unsubscribe(userId: number, endpoint: string): Promise<void> {
    await this.repo.removeByEndpoint(userId, endpoint);
  }

  /** Sends to every browser the user subscribed; ones the push service says are gone are dropped. */
  async notify(userId: number, message: { title: string; body: string; url: string }): Promise<void> {
    const subscriptions = await this.repo.findByUserId(userId);
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      icon: `${this.config.publicUrl}/favicon.ico`,
      data: { url: message.url, type: "BOOKING" },
      tag: `cal-notification-${Date.now()}`,
    });
    const fetchImpl = this.config.fetchImpl ?? fetch;
    await Promise.all(
      subscriptions.map(async ({ id, subscription }) => {
        const { url, init } = await buildPushRequest(subscription, payload, this.config.vapid);
        const response = await fetchImpl(url, init);
        if (response.status === 404 || response.status === 410) await this.repo.removeById(id);
        else if (!response.ok) console.error(`Push to ${new URL(url).origin} returned ${response.status}`);
      })
    );
  }

  async onBookingEvent(event: BookingEvent): Promise<void> {
    const requested = event.type === "BOOKING_REQUESTED";
    // New bookings only: not confirmations of requests, and one message per recurring series.
    if ((event.type !== "BOOKING_CREATED" && !requested) || event.confirmed || (event.seriesIndex ?? 0) > 0)
      return;
    const { booking } = event;
    const { locale, timeZone } = booking.organizer;
    const t = createT(await this.config.loadMessages(locale, MESSAGE_KEYS), locale);
    await this.notify(booking.organizer.id, {
      title: t(requested ? "event_awaiting_approval" : "new_event_scheduled"),
      body: `${booking.title}\n${formatLongDate(booking.startTime, timeZone, locale)} ${formatTime(booking.startTime, timeZone, locale)}`,
      url: `${this.config.publicUrl}/bookings/${requested ? "unconfirmed" : "upcoming"}`,
    });
  }
}

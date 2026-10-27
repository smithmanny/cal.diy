import { describe, expect, it, vi } from "vitest";
import type { BookingSnapshot } from "../bookings/events";
import { pickMessages } from "../catalog";
import { PushService } from "./PushService";
import { base64UrlEncode } from "./webPush";

async function keys() {
  const vapid = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ])) as CryptoKeyPair;
  const browser = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  return {
    vapid: {
      publicKey: base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", vapid.publicKey))),
      privateKey: (await crypto.subtle.exportKey("jwk", vapid.privateKey)).d ?? "",
      subject: "https://cal.test",
    },
    subscriptionKeys: {
      p256dh: base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", browser.publicKey))),
      auth: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))),
    },
  };
}

async function setup(status = 201) {
  const { vapid, subscriptionKeys } = await keys();
  const repo = {
    findByUserId: vi.fn(async () => [
      { id: 1, subscription: { endpoint: "https://push.example.com/a", keys: subscriptionKeys } },
      { id: 2, subscription: { endpoint: "https://push.example.com/b", keys: subscriptionKeys } },
    ]),
    save: vi.fn(async () => undefined),
    removeByEndpoint: vi.fn(async () => undefined),
    removeById: vi.fn(async () => undefined),
  };
  const fetchImpl = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) => new Response(null, { status })
  );
  const service = new PushService(repo, {
    vapid,
    publicUrl: "https://cal.test",
    allowInsecureEndpoints: false,
    loadMessages: pickMessages,
    fetchImpl,
  });
  return { service, repo, fetchImpl, subscriptionKeys };
}

const booking = {
  title: "Intro between Hana and Greta",
  startTime: new Date("2030-01-07T15:00:00Z"),
  organizer: { id: 7, timeZone: "UTC", locale: "en" },
} as BookingSnapshot;

describe("PushService", () => {
  it("only accepts HTTPS push services", async () => {
    const { service, repo, subscriptionKeys } = await setup();
    await expect(
      service.subscribe(7, { endpoint: "http://10.0.0.1/admin", keys: subscriptionKeys })
    ).rejects.toMatchObject({ status: 400 });
    await service.subscribe(7, { endpoint: "https://push.example.com/a", keys: subscriptionKeys });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it("pushes new bookings to each of the organizer's browsers", async () => {
    const { service, fetchImpl } = await setup();
    await service.onBookingEvent({ type: "BOOKING_CREATED", booking });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "https://push.example.com/a",
      "https://push.example.com/b",
    ]);
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({ "content-encoding": "aes128gcm" });
  });

  it("stays quiet for confirmations, later occurrences and other events", async () => {
    const { service, fetchImpl } = await setup();
    await service.onBookingEvent({ type: "BOOKING_CREATED", booking, confirmed: true });
    await service.onBookingEvent({ type: "BOOKING_CREATED", booking, seriesIndex: 1 });
    await service.onBookingEvent({ type: "BOOKING_CANCELLED", booking });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("forgets subscriptions the push service says are gone", async () => {
    const { service, repo } = await setup(410);
    await service.notify(7, { title: "t", body: "b", url: "https://cal.test" });
    expect(repo.removeById.mock.calls).toEqual([[1], [2]]);
  });
});

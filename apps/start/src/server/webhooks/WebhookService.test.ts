import type { Database } from "@calcom/db/database";
import { user, webhook } from "@calcom/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../test/testDb";
import type { BookingSnapshot } from "../bookings/events";
import type { WebhookInput } from "./types";
import { WebhookRepository } from "./WebhookRepository";
import { WebhookService } from "./WebhookService";
import { createWebhookListener } from "./webhookListener";

let db: Database;
let repo: WebhookRepository;
let service: WebhookService;
let ownerId: number;
let otherId: number;

const input: WebhookInput = {
  subscriberUrl: "https://hooks.example/cal",
  eventTriggers: ["BOOKING_CREATED", "BOOKING_CANCELLED"],
  active: true,
  secret: "s3cret",
  payloadTemplate: null,
};

beforeEach(async () => {
  db = await createTestDb();
  repo = new WebhookRepository(db);
  service = new WebhookService(repo);
  [{ id: ownerId }, { id: otherId }] = await db
    .insert(user)
    .values([{ email: "owner@example.com" }, { email: "other@example.com" }])
    .returning({ id: user.id });
});

describe("WebhookService", () => {
  it("creates, lists without exposing the secret, updates and deletes", async () => {
    const { id } = await service.create(ownerId, input);
    expect(await service.list(ownerId)).toEqual([
      {
        id,
        subscriberUrl: input.subscriberUrl,
        eventTriggers: input.eventTriggers,
        active: true,
        hasSecret: true,
        payloadTemplate: null,
      },
    ]);

    // Omitting the secret keeps it; an empty string clears it.
    await service.update(ownerId, id, { ...input, secret: undefined, active: false });
    expect((await service.get(ownerId, id)).hasSecret).toBe(true);
    await service.update(ownerId, id, { ...input, secret: "" });
    expect((await service.get(ownerId, id)).hasSecret).toBe(false);

    await service.delete(ownerId, id);
    expect(await service.list(ownerId)).toEqual([]);
  });

  it("rejects a duplicate URL for the same user and hides other users' webhooks", async () => {
    const { id } = await service.create(ownerId, input);
    await expect(service.create(ownerId, input)).rejects.toMatchObject({
      code: "webhook_subscriber_url_reserved",
    });
    await expect(service.get(otherId, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.delete(otherId, id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("webhook listener", () => {
  it("sends booking events only to the organizer's active webhooks subscribed to that trigger", async () => {
    await service.create(ownerId, input);
    await service.create(ownerId, {
      ...input,
      subscriberUrl: "https://hooks.example/only-rescheduled",
      eventTriggers: ["BOOKING_RESCHEDULED"],
    });
    await service.create(ownerId, {
      ...input,
      subscriberUrl: "https://hooks.example/inactive",
      active: false,
    });
    await service.create(otherId, { ...input, subscriberUrl: "https://hooks.example/someone-else" });
    // Rows written by older Cal code may hold triggers this app doesn't emit; they must not break delivery.
    await db.insert(webhook).values({
      id: crypto.randomUUID(),
      userId: ownerId,
      subscriberUrl: "https://hooks.example/legacy",
      eventTriggers: ["MEETING_ENDED"],
    });

    const fetchMock = vi.fn(async (_request: Request) => new Response("ok"));
    const listener = createWebhookListener(repo, fetchMock as unknown as typeof fetch);
    const booking = {
      uid: "u",
      title: "T",
      description: null,
      startTime: new Date("2030-01-07T10:00:00Z"),
      endTime: new Date("2030-01-07T10:30:00Z"),
      status: "ACCEPTED",
      location: null,
      responses: {},
      cancellationReason: null,
      fromReschedule: null,
      bookingFields: null,
      recurring: null,
      eventType: null,
      organizer: {
        id: ownerId,
        name: null,
        email: "owner@example.com",
        username: null,
        timeZone: "UTC",
        locale: "en",
      },
      attendees: [],
    } satisfies BookingSnapshot;

    await listener({ type: "BOOKING_CREATED", booking });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][0];
    expect(request.url).toBe("https://hooks.example/cal");
    expect(JSON.parse(await request.text())).toMatchObject({
      triggerEvent: "BOOKING_CREATED",
      payload: { uid: "u" },
    });
  });
});

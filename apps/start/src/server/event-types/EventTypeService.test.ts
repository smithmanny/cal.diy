import type { Database } from "@calcom/db/database";
import { eventType, schedule, user } from "@calcom/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { ScheduleRepository } from "../schedules/ScheduleRepository";
import { EventTypeRepository } from "./EventTypeRepository";
import { EventTypeService } from "./EventTypeService";
import type { EventTypeInput } from "./types";

let db: Database;
let service: EventTypeService;
let ownerId: number;
let otherId: number;

beforeEach(async () => {
  db = await createTestDb();
  service = new EventTypeService({
    eventTypeRepo: new EventTypeRepository(db),
    scheduleRepo: new ScheduleRepository(db),
  });
  [{ id: ownerId }, { id: otherId }] = await db
    .insert(user)
    .values([{ email: "owner@example.com" }, { email: "other@example.com" }])
    .returning({ id: user.id });
});

const baseInput = async (id: number): Promise<EventTypeInput> => {
  const { id: _id, ...rest } = await service.get(ownerId, id);
  return rest;
};

describe("EventTypeService", () => {
  it("creates with a slugified URL, Cal's defaults, and newest first", async () => {
    const first = await service.create(ownerId, {
      title: "Intro Call",
      slug: "",
      description: null,
      length: 30,
    });
    const second = await service.create(ownerId, {
      title: "Deep Dive",
      slug: "Deep Dive!",
      description: "x",
      length: 60,
    });

    expect(await service.get(ownerId, first.id)).toMatchObject({
      slug: "intro-call",
      minimumBookingNotice: 120,
      periodType: "UNLIMITED",
      locations: [],
      hidden: false,
    });
    expect((await service.list(ownerId)).map((e) => e.id)).toEqual([second.id, first.id]);
    expect((await service.get(ownerId, second.id)).slug).toBe("deep-dive");
  });

  it("rejects a URL the same user already uses, but allows it for other users", async () => {
    await service.create(ownerId, { title: "Intro", slug: "intro", description: null, length: 30 });
    await expect(
      service.create(ownerId, { title: "Intro 2", slug: "intro", description: null, length: 30 })
    ).rejects.toMatchObject({ code: "url_taken" });
    await expect(
      service.create(otherId, { title: "Intro", slug: "intro", description: null, length: 30 })
    ).resolves.toBeTruthy();
  });

  it("updates every editable field and keeps the slug unique on update", async () => {
    const { id } = await service.create(ownerId, {
      title: "Intro",
      slug: "intro",
      description: null,
      length: 30,
    });
    await service.create(ownerId, { title: "Other", slug: "other", description: null, length: 30 });
    const [{ id: scheduleId }] = await db
      .insert(schedule)
      .values({ userId: ownerId, name: "S" })
      .returning({ id: schedule.id });

    const input: EventTypeInput = {
      ...(await baseInput(id)),
      title: "Intro (updated)",
      length: 45,
      hidden: true,
      scheduleId,
      locations: [{ type: "inPerson", address: "1 Main St" }, { type: "phone" }],
      minimumBookingNotice: 60,
      beforeEventBuffer: 5,
      afterEventBuffer: 10,
      slotInterval: 15,
      periodType: "ROLLING",
      periodDays: 14,
      periodCountCalendarDays: false,
      requiresConfirmation: true,
    };
    await service.update(ownerId, id, input);
    expect(await service.get(ownerId, id)).toEqual({ id, ...input });

    await expect(service.update(ownerId, id, { ...input, slug: "other" })).rejects.toMatchObject({
      code: "url_taken",
    });
  });

  it("refuses to attach someone else's schedule", async () => {
    const { id } = await service.create(ownerId, {
      title: "Intro",
      slug: "intro",
      description: null,
      length: 30,
    });
    const [{ id: foreignSchedule }] = await db
      .insert(schedule)
      .values({ userId: otherId, name: "Theirs" })
      .returning({ id: schedule.id });
    await expect(
      service.update(ownerId, id, { ...(await baseInput(id)), scheduleId: foreignSchedule })
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("drops location types it doesn't understand instead of failing", async () => {
    const { id } = await service.create(ownerId, {
      title: "Intro",
      slug: "intro",
      description: null,
      length: 30,
    });
    await db
      .update(eventType)
      .set({ locations: [{ type: "integrations:zoom" }, { type: "link", link: "https://example.com/room" }] })
      .where(eq(eventType.id, id));
    expect((await service.get(ownerId, id)).locations).toEqual([
      { type: "link", link: "https://example.com/room" },
    ]);
  });

  it("hides other users' event types as not found and deletes owned ones", async () => {
    const { id } = await service.create(ownerId, {
      title: "Intro",
      slug: "intro",
      description: null,
      length: 30,
    });
    await expect(service.get(otherId, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.delete(otherId, id)).rejects.toMatchObject({ code: "not_found" });
    await service.setHidden(ownerId, id, true);
    expect((await service.list(ownerId))[0].hidden).toBe(true);
    await service.delete(ownerId, id);
    expect(await service.list(ownerId)).toEqual([]);
  });

  it("creates Cal's two default event types", async () => {
    await service.createDefaults(ownerId, { fifteen: "15 min meeting", thirty: "30 min meeting" });
    expect((await service.list(ownerId)).map((e) => [e.slug, e.length])).toEqual([
      ["30min", 30],
      ["15min", 15],
    ]);
  });
});

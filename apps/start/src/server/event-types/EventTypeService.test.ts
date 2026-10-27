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

  it("saves booking questions in Cal's format, keeping Cal properties the editor doesn't know", async () => {
    const { id } = await service.create(ownerId, {
      title: "Intro",
      slug: "intro",
      description: null,
      length: 30,
    });
    await db
      .update(eventType)
      .set({
        bookingFields: [
          { name: "notes", type: "textarea", sources: [{ id: "workflow", type: "workflow", label: "W" }] },
        ],
      })
      .where(eq(eventType.id, id));
    const input = await baseInput(id);
    const fields = input.bookingFields.map((field) =>
      field.name === "notes" ? { ...field, hidden: true } : field
    );
    fields.splice(4, 0, { name: "company", type: "text", label: "Company", required: true, hidden: false });
    await service.update(ownerId, id, { ...input, bookingFields: fields });

    const [stored] = await db
      .select({ fields: eventType.bookingFields })
      .from(eventType)
      .where(eq(eventType.id, id));
    const saved = stored.fields as { name: string; hidden?: boolean; editable?: string; sources?: unknown }[];
    expect(saved.map((field) => field.name)).toEqual([
      "name",
      "email",
      "attendeePhoneNumber",
      "location",
      "company",
      // Stored fields keep their place; missing system fields are added after them.
      "notes",
      "title",
      "guests",
      "rescheduleReason",
    ]);
    expect(saved.find((field) => field.name === "company")).toMatchObject({ editable: "user" });
    expect(saved.find((field) => field.name === "notes")).toMatchObject({
      hidden: true,
      sources: [{ id: "workflow" }],
    });

    await expect(
      service.update(ownerId, id, {
        ...input,
        bookingFields: fields.filter((field) => field.name !== "email"),
      })
    ).rejects.toMatchObject({ code: "booking_question_system_field_removed" });
  });

  it("keeps the confirmation threshold in Cal's metadata without touching other keys", async () => {
    const { id } = await service.create(ownerId, {
      title: "Intro",
      slug: "intro",
      description: null,
      length: 30,
    });
    await db
      .update(eventType)
      .set({ metadata: { apps: { stripe: { enabled: true } } } })
      .where(eq(eventType.id, id));
    const input = await baseInput(id);
    await service.update(ownerId, id, {
      ...input,
      requiresConfirmation: true,
      requiresConfirmationThreshold: { time: 4, unit: "hours" },
      requiresConfirmationWillBlockSlot: true,
    });
    const metadataOf = async () =>
      (await db.select({ metadata: eventType.metadata }).from(eventType).where(eq(eventType.id, id)))[0]
        .metadata;
    expect(await metadataOf()).toEqual({
      apps: { stripe: { enabled: true } },
      requiresConfirmationThreshold: { time: 4, unit: "hours" },
    });
    expect(await service.get(ownerId, id)).toMatchObject({
      requiresConfirmationThreshold: { time: 4, unit: "hours" },
      requiresConfirmationWillBlockSlot: true,
    });

    await service.update(ownerId, id, { ...(await baseInput(id)), requiresConfirmation: false });
    expect(await metadataOf()).toEqual({ apps: { stripe: { enabled: true } } });
    expect((await service.get(ownerId, id)).requiresConfirmationWillBlockSlot).toBe(false);
  });

  it("saves display and privacy options, keeping Cal's other email switches", async () => {
    const { id } = await service.create(ownerId, {
      title: "Intro",
      slug: "intro",
      description: null,
      length: 30,
    });
    await db
      .update(eventType)
      .set({ metadata: { disableStandardEmails: { all: { host: true } } }, eventTypeColor: { bad: 1 } })
      .where(eq(eventType.id, id));
    const input = await baseInput(id);
    expect(input).toMatchObject({ eventTypeColor: null, interfaceLanguage: null });
    await service.update(ownerId, id, {
      ...input,
      hideOrganizerEmail: true,
      lockTimeZoneToggleOnBookingPage: true,
      lockedTimeZone: "Europe/Berlin",
      eventTypeColor: { lightEventTypeColor: "#112233", darkEventTypeColor: "#ddeeff" },
      interfaceLanguage: "de",
      disableConfirmationEmails: { host: false, attendee: true },
    });
    expect(await service.get(ownerId, id)).toMatchObject({
      hideOrganizerEmail: true,
      lockedTimeZone: "Europe/Berlin",
      eventTypeColor: { lightEventTypeColor: "#112233" },
      interfaceLanguage: "de",
      disableConfirmationEmails: { host: false, attendee: true },
    });
    const [row] = await db
      .select({ metadata: eventType.metadata })
      .from(eventType)
      .where(eq(eventType.id, id));
    expect(row.metadata).toEqual({
      disableStandardEmails: { all: { host: true }, confirmation: { host: false, attendee: true } },
    });
    expect((await service.list(ownerId))[0].eventTypeColor).toEqual({
      lightEventTypeColor: "#112233",
      darkEventTypeColor: "#ddeeff",
    });

    await service.update(ownerId, id, {
      ...(await baseInput(id)),
      lockTimeZoneToggleOnBookingPage: false,
      disableConfirmationEmails: { host: false, attendee: false },
    });
    expect((await service.get(ownerId, id)).lockedTimeZone).toBeNull();
    const [after] = await db
      .select({ metadata: eventType.metadata })
      .from(eventType)
      .where(eq(eventType.id, id));
    expect(after.metadata).toEqual({ disableStandardEmails: { all: { host: true } } });
  });

  it("stores multiple durations in Cal's metadata", async () => {
    const { id } = await service.create(ownerId, {
      title: "Intro",
      slug: "intro",
      description: null,
      length: 30,
    });
    await service.update(ownerId, id, {
      ...(await baseInput(id)),
      length: 30,
      multipleDuration: [60, 30, 15],
    });
    expect((await service.get(ownerId, id)).multipleDuration).toEqual([15, 30, 60]);
    await service.update(ownerId, id, { ...(await baseInput(id)), multipleDuration: [30] });
    expect((await service.get(ownerId, id)).multipleDuration).toBeNull();
  });

  it("stores recurring rules in Cal's shape, capping long series", async () => {
    const { id } = await service.create(ownerId, {
      title: "Intro",
      slug: "intro",
      description: null,
      length: 30,
    });
    await service.update(ownerId, id, {
      ...(await baseInput(id)),
      recurringEvent: { freq: 1, interval: 2, count: 6 },
    });
    expect((await service.get(ownerId, id)).recurringEvent).toEqual({ freq: 1, interval: 2, count: 6 });
    await db
      .update(eventType)
      .set({ recurringEvent: { freq: 2, interval: 1, count: 500, dtstart: "2020-01-01" } })
      .where(eq(eventType.id, id));
    expect((await service.get(ownerId, id)).recurringEvent).toEqual({ freq: 2, interval: 1, count: 100 });
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

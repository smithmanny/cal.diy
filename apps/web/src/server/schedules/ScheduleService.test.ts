import type { Database } from "@calcom/db/database";
import { availability, user } from "@calcom/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { UserRepository } from "../users/UserRepository";
import { ScheduleRepository } from "./ScheduleRepository";
import { ScheduleService } from "./ScheduleService";
import { DEFAULT_WEEKLY_HOURS } from "./scheduleMapper";
import type { ScheduleInput } from "./types";

let db: Database;
let service: ScheduleService;
let ownerId: number;
let otherId: number;

const input: ScheduleInput = {
  name: "Work",
  timeZone: "Europe/Berlin",
  weeklyHours: DEFAULT_WEEKLY_HOURS,
  dateOverrides: [{ date: "2026-12-25", ranges: [] }],
};

beforeEach(async () => {
  db = await createTestDb();
  service = new ScheduleService({
    scheduleRepo: new ScheduleRepository(db),
    userRepo: new UserRepository(db),
  });
  [{ id: ownerId }, { id: otherId }] = await db
    .insert(user)
    .values([{ email: "owner@example.com" }, { email: "other@example.com" }])
    .returning({ id: user.id });
});

describe("ScheduleService", () => {
  it("creates a schedule, makes the first one default, and reads it back", async () => {
    const { id } = await service.create(ownerId, input);

    expect(await service.get(ownerId, id, "UTC")).toEqual({ id, isDefault: true, ...input });
    const second = await service.create(ownerId, { ...input, name: "Evenings" });
    expect((await service.get(ownerId, second.id, "UTC")).isDefault).toBe(false);
  });

  it("lists schedules with the default flagged", async () => {
    const first = await service.create(ownerId, input);
    const second = await service.create(ownerId, { ...input, name: "Evenings" });
    await service.setDefault(ownerId, second.id);

    const list = await service.list(ownerId, "UTC");
    expect(list.map((s) => [s.id, s.isDefault])).toEqual([
      [first.id, false],
      [second.id, true],
    ]);
  });

  it("replaces availability on update without leaving stale rows", async () => {
    const { id } = await service.create(ownerId, input);
    const weeklyHours = [[], [{ start: "10:00", end: "11:00" }], [], [], [], [], []];
    await service.update(ownerId, id, { ...input, name: "Mornings", weeklyHours, dateOverrides: [] });

    expect(await service.get(ownerId, id, "UTC")).toMatchObject({
      name: "Mornings",
      weeklyHours,
      dateOverrides: [],
    });
    expect(await db.select({ id: availability.id }).from(availability)).toHaveLength(1);
  });

  it("rejects invalid schedules with a translation key", async () => {
    await expect(service.create(ownerId, { ...input, timeZone: "Nope/Nope" })).rejects.toMatchObject({
      code: "invalid_timezone",
    });
  });

  it("hides other users' schedules as not found", async () => {
    const { id } = await service.create(ownerId, input);
    await expect(service.get(otherId, id, "UTC")).rejects.toMatchObject({ code: "not_found", status: 404 });
    await expect(service.update(otherId, id, input)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.delete(otherId, id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuses to delete the default schedule but deletes others with their availability", async () => {
    const first = await service.create(ownerId, input);
    const second = await service.create(ownerId, input);

    await expect(service.delete(ownerId, first.id)).rejects.toMatchObject({
      code: "cannot_delete_default_schedule",
    });
    await service.delete(ownerId, second.id);

    expect((await service.list(ownerId, "UTC")).map((s) => s.id)).toEqual([first.id]);
    const rows = await db.select({ scheduleId: availability.scheduleId }).from(availability);
    expect(rows.every((row) => row.scheduleId === first.id)).toBe(true);
  });
});

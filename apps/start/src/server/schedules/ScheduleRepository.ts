import "@tanstack/react-start/server-only";
import type { Database } from "@calcom/db/database";
import { availability, schedule } from "@calcom/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { AvailabilityRow } from "./scheduleMapper";

const availabilityColumns = {
  scheduleId: availability.scheduleId,
  days: availability.days,
  startTime: availability.startTime,
  endTime: availability.endTime,
  date: availability.date,
};

export type ScheduleWithAvailability = {
  id: number;
  userId: number;
  name: string;
  timeZone: string | null;
  availability: AvailabilityRow[];
};

export class ScheduleRepository {
  constructor(private readonly db: Database) {}

  async findManyByUserIdIncludeAvailability(userId: number): Promise<ScheduleWithAvailability[]> {
    const schedules = await this.db
      .select({ id: schedule.id, userId: schedule.userId, name: schedule.name, timeZone: schedule.timeZone })
      .from(schedule)
      .where(eq(schedule.userId, userId))
      .orderBy(asc(schedule.id));
    if (!schedules.length) return [];

    const rows = await this.db
      .select(availabilityColumns)
      .from(availability)
      .where(
        inArray(
          availability.scheduleId,
          schedules.map((s) => s.id)
        )
      );
    const rowsBySchedule = new Map<number, AvailabilityRow[]>();
    for (const { scheduleId, ...row } of rows) {
      if (scheduleId === null) continue;
      rowsBySchedule.set(scheduleId, [...(rowsBySchedule.get(scheduleId) ?? []), row]);
    }
    return schedules.map((s) => ({ ...s, availability: rowsBySchedule.get(s.id) ?? [] }));
  }

  async findByIdIncludeAvailability(id: number): Promise<ScheduleWithAvailability | null> {
    const [found] = await this.db
      .select({ id: schedule.id, userId: schedule.userId, name: schedule.name, timeZone: schedule.timeZone })
      .from(schedule)
      .where(eq(schedule.id, id))
      .limit(1);
    if (!found) return null;
    const rows = await this.db
      .select(availabilityColumns)
      .from(availability)
      .where(eq(availability.scheduleId, id));
    return { ...found, availability: rows.map(({ scheduleId: _scheduleId, ...row }) => row) };
  }

  async create(data: { userId: number; name: string; timeZone: string; availability: AvailabilityRow[] }) {
    const [created] = await this.db
      .insert(schedule)
      .values({ userId: data.userId, name: data.name, timeZone: data.timeZone })
      .returning({ id: schedule.id });
    // D1 has no interactive transactions and the rows need the new id, so this is two steps;
    // undo the schedule if the rows fail rather than leave an empty schedule behind.
    try {
      if (data.availability.length) {
        await this.db
          .insert(availability)
          .values(data.availability.map((row) => ({ ...row, scheduleId: created.id, userId: data.userId })));
      }
    } catch (error) {
      await this.db.delete(schedule).where(eq(schedule.id, created.id));
      throw error;
    }
    return created;
  }

  async replace(data: {
    id: number;
    userId: number;
    name: string;
    timeZone: string;
    availability: AvailabilityRow[];
  }) {
    const statements = [
      this.db
        .update(schedule)
        .set({ name: data.name, timeZone: data.timeZone })
        .where(eq(schedule.id, data.id)),
      this.db.delete(availability).where(eq(availability.scheduleId, data.id)),
    ] as const;
    if (!data.availability.length) {
      await this.db.batch(statements);
      return;
    }
    await this.db.batch([
      ...statements,
      this.db
        .insert(availability)
        .values(data.availability.map((row) => ({ ...row, scheduleId: data.id, userId: data.userId }))),
    ]);
  }

  async deleteById(id: number) {
    // Availability.scheduleId is ON DELETE SET NULL, so remove the rows explicitly instead of orphaning them.
    await this.db.batch([
      this.db.delete(availability).where(eq(availability.scheduleId, id)),
      this.db.delete(schedule).where(eq(schedule.id, id)),
    ]);
  }

  async existsForUser(id: number, userId: number): Promise<boolean> {
    const [found] = await this.db
      .select({ id: schedule.id })
      .from(schedule)
      .where(and(eq(schedule.id, id), eq(schedule.userId, userId)))
      .limit(1);
    return Boolean(found);
  }
}

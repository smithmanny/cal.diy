import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { travelSchedule } from "@calcom/db/schema";
import { and, asc, eq } from "drizzle-orm";

const columns = {
  id: travelSchedule.id,
  timeZone: travelSchedule.timeZone,
  startDate: travelSchedule.startDate,
  endDate: travelSchedule.endDate,
};

export class TravelScheduleRepository {
  constructor(private readonly db: Database) {}

  findByUserId(userId: number) {
    return this.db
      .select(columns)
      .from(travelSchedule)
      .where(eq(travelSchedule.userId, userId))
      .orderBy(asc(travelSchedule.startDate));
  }

  async create(data: { userId: number; timeZone: string; startDate: Date; endDate: Date | null }) {
    const [created] = await this.db.insert(travelSchedule).values(data).returning(columns);
    return created;
  }

  async deleteByIdAndUserId(id: number, userId: number): Promise<void> {
    await this.db
      .delete(travelSchedule)
      .where(and(eq(travelSchedule.id, id), eq(travelSchedule.userId, userId)));
  }
}

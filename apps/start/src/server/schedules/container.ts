import "@tanstack/react-start/server-only";

import { getDb } from "../db";
import { UserRepository } from "../users/UserRepository";
import { ScheduleRepository } from "./ScheduleRepository";
import { ScheduleService } from "./ScheduleService";

export async function getScheduleService(): Promise<ScheduleService> {
  const db = await getDb();
  return new ScheduleService({ scheduleRepo: new ScheduleRepository(db), userRepo: new UserRepository(db) });
}

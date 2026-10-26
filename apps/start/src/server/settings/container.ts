import "@tanstack/react-start/server-only";

import { getDb } from "../db";
import { TravelScheduleRepository } from "../users/TravelScheduleRepository";
import { UserRepository } from "../users/UserRepository";

export async function getSettingsRepositories() {
  const db = await getDb();
  return { users: new UserRepository(db), travelSchedules: new TravelScheduleRepository(db) };
}

import "@tanstack/react-start/server-only";

import { createAppsService } from "../apps/container";
import { getDb } from "../db";
import { ScheduleRepository } from "../schedules/ScheduleRepository";
import { EventTypeRepository } from "./EventTypeRepository";
import { EventTypeService } from "./EventTypeService";
import { HashedLinkRepository } from "./HashedLinkRepository";

export async function getEventTypeService(): Promise<EventTypeService> {
  const db = await getDb();
  const apps = createAppsService(db);
  return new EventTypeService({
    eventTypeRepo: new EventTypeRepository(db),
    scheduleRepo: new ScheduleRepository(db),
    hashedLinkRepo: new HashedLinkRepository(db),
    defaultLocation: (userId) => apps.defaultLocation(userId),
  });
}

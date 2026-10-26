import "@tanstack/react-start/server-only";

import { getDb } from "../db";
import { ScheduleRepository } from "../schedules/ScheduleRepository";
import { EventTypeRepository } from "./EventTypeRepository";
import { EventTypeService } from "./EventTypeService";

export async function getEventTypeService(): Promise<EventTypeService> {
  const db = await getDb();
  return new EventTypeService({
    eventTypeRepo: new EventTypeRepository(db),
    scheduleRepo: new ScheduleRepository(db),
  });
}

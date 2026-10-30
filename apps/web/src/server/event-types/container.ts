import "@tanstack/react-start/server-only";

import { createAppsService } from "../apps/container";
import { getDb } from "../db";
import { ScheduleRepository } from "../schedules/ScheduleRepository";
import { TeamRepository } from "../teams/TeamRepository";
import { canManage } from "../teams/TeamService";
import { EventTypeRepository } from "./EventTypeRepository";
import { EventTypeService } from "./EventTypeService";
import { HashedLinkRepository } from "./HashedLinkRepository";
import { TeamEventTypeService } from "./TeamEventTypeService";

export async function getEventTypeService(): Promise<EventTypeService> {
  const db = await getDb();
  const apps = createAppsService(db);
  return new EventTypeService({
    eventTypeRepo: new EventTypeRepository(db),
    scheduleRepo: new ScheduleRepository(db),
    hashedLinkRepo: new HashedLinkRepository(db),
    defaultLocation: (userId) => apps.defaultLocation(userId),
    canManageTeam: async (userId, teamId) => canManage(await new TeamRepository(db).findRole(teamId, userId)),
  });
}

export async function getTeamEventTypeService(): Promise<TeamEventTypeService> {
  const db = await getDb();
  return new TeamEventTypeService({
    eventTypeRepo: new EventTypeRepository(db),
    teamRepo: new TeamRepository(db),
  });
}

import "@tanstack/react-start/server-only";

import { getBookingActionsService, getBookingService } from "../bookings/container";
import { getDb } from "../db";
import { getEventTypeService } from "../event-types/container";
import { EventTypeRepository } from "../event-types/EventTypeRepository";
import { getScheduleService } from "../schedules/container";
import { TeamRepository } from "../teams/TeamRepository";
import { UserRepository } from "../users/UserRepository";
import { ApiBookingRepository } from "./ApiBookingRepository";
import { ApiBookingService } from "./ApiBookingService";
import { ApiEventTypeService } from "./ApiEventTypeService";
import { ApiScheduleService } from "./ApiScheduleService";
import { ApiUserRepository } from "./ApiUserRepository";

async function getApiUserRepository(): Promise<ApiUserRepository> {
  return new ApiUserRepository(await getDb());
}

async function getApiBookingService(): Promise<ApiBookingService> {
  const db = await getDb();
  return new ApiBookingService({
    bookings: await getBookingService(),
    actions: await getBookingActionsService(),
    apiBookings: new ApiBookingRepository(db),
    eventTypeRepo: new EventTypeRepository(db),
    users: new ApiUserRepository(db),
    teams: new TeamRepository(db),
  });
}

async function getApiEventTypeService(): Promise<ApiEventTypeService> {
  const db = await getDb();
  return new ApiEventTypeService({
    eventTypes: await getEventTypeService(),
    users: new ApiUserRepository(db),
    userRepo: new UserRepository(db),
    eventTypeRepo: new EventTypeRepository(db),
  });
}

async function getApiScheduleService(): Promise<ApiScheduleService> {
  return new ApiScheduleService({
    schedules: await getScheduleService(),
    users: await getApiUserRepository(),
  });
}

export { getApiUserRepository, getApiBookingService, getApiEventTypeService, getApiScheduleService };

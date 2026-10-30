import "@tanstack/react-start/server-only";

import { getDb } from "../db";
import { EventTypeRepository } from "../event-types/EventTypeRepository";
import { HashedLinkRepository } from "../event-types/HashedLinkRepository";
import { createHolidayService } from "../holidays/container";
import { OutOfOfficeRepository } from "../out-of-office/OutOfOfficeRepository";
import { createPaymentService } from "../payments/container";
import { ScheduleRepository } from "../schedules/ScheduleRepository";
import { TeamRepository } from "../teams/TeamRepository";
import { TravelScheduleRepository } from "../users/TravelScheduleRepository";
import { UserRepository } from "../users/UserRepository";
import { createBookerVerification } from "../verification/container";
import { BookingActionsService } from "./BookingActionsService";
import { BookingAuditRepository } from "./BookingAuditRepository";
import { BookingRepository } from "./BookingRepository";
import { BookingService } from "./BookingService";
import { getBookingListeners, getBusyTimesProviders } from "./integrations";
import { TeamEventLoader } from "./teamEvents";
import { runInBackground } from "#runtime";

export async function getBookingService(): Promise<BookingService> {
  const db = await getDb();
  return new BookingService({
    userRepo: new UserRepository(db),
    eventTypeRepo: new EventTypeRepository(db),
    scheduleRepo: new ScheduleRepository(db),
    bookingRepo: new BookingRepository(db),
    travelScheduleRepo: new TravelScheduleRepository(db),
    oooRepo: new OutOfOfficeRepository(db),
    holidayService: createHolidayService(db),
    bookerVerification: createBookerVerification(db),
    hashedLinkRepo: new HashedLinkRepository(db),
    teamRepo: new TeamRepository(db),
    teamEvents: new TeamEventLoader({
      teamRepo: new TeamRepository(db),
      eventTypeRepo: new EventTypeRepository(db),
      userRepo: new UserRepository(db),
    }),
    busyTimesProviders: getBusyTimesProviders(db),
    listeners: getBookingListeners(db),
    payments: createPaymentService(db) ?? undefined,
    runInBackground,
  });
}

export async function getBookingActionsService(): Promise<BookingActionsService> {
  const db = await getDb();
  return new BookingActionsService({
    bookingRepo: new BookingRepository(db),
    events: await getBookingService(),
    auditRepo: new BookingAuditRepository(db),
  });
}

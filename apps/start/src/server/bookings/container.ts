import "@tanstack/react-start/server-only";

import { getDb } from "../db";
import { EventTypeRepository } from "../event-types/EventTypeRepository";
import { HashedLinkRepository } from "../event-types/HashedLinkRepository";
import { createHolidayService } from "../holidays/container";
import { OutOfOfficeRepository } from "../out-of-office/OutOfOfficeRepository";
import { ScheduleRepository } from "../schedules/ScheduleRepository";
import { TravelScheduleRepository } from "../users/TravelScheduleRepository";
import { UserRepository } from "../users/UserRepository";
import { createBookerVerification } from "../verification/container";
import { BookingActionsService } from "./BookingActionsService";
import { BookingRepository } from "./BookingRepository";
import { BookingService } from "./BookingService";
import { getBookingListeners, getBusyTimesProviders } from "./integrations";
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
    busyTimesProviders: getBusyTimesProviders(db),
    listeners: getBookingListeners(db),
    runInBackground,
  });
}

export async function getBookingActionsService(): Promise<BookingActionsService> {
  const db = await getDb();
  return new BookingActionsService({
    bookingRepo: new BookingRepository(db),
    events: await getBookingService(),
  });
}

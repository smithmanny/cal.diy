import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import type { BusyTimesProvider } from "./BookingService";
import type { BookingListener } from "./events";

// Webhooks, emails and calendar sync register here as they are ported.
export function getBookingListeners(_db: Database): BookingListener[] {
  return [];
}

export function getBusyTimesProviders(_db: Database): BusyTimesProvider[] {
  return [];
}

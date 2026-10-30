import "@tanstack/react-start/server-only";

import process from "node:process";
import type { Database } from "@calcom/db/database";
import { googleEndpoints } from "../calendars/google/endpoints";
import { getDb } from "../db";
import { createGoogleHolidayFetcher } from "./googleHolidays";
import { HolidayRepository } from "./HolidayRepository";
import { HolidayService } from "./HolidayService";

export function createHolidayService(db: Database): HolidayService {
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
  return new HolidayService({
    repo: new HolidayRepository(db),
    fetchHolidays: apiKey
      ? createGoogleHolidayFetcher({ apiBase: googleEndpoints().calendarApi, apiKey })
      : null,
  });
}

export async function getHolidayService(): Promise<HolidayService> {
  return createHolidayService(await getDb());
}

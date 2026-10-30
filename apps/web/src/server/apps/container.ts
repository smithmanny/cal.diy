import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { createCalendarService } from "../calendars/container";
import { getDb } from "../db";
import { createStripeClient } from "../payments/container";
import { UserRepository } from "../users/UserRepository";
import { createVideoService } from "../video/container";
import { AppsService } from "./AppsService";
import { CredentialRepository } from "./CredentialRepository";

export function createAppsService(db: Database): AppsService {
  return new AppsService({
    credentials: new CredentialRepository(db),
    users: new UserRepository(db),
    calendars: createCalendarService(db),
    video: createVideoService(db),
    paymentsConfigured: createStripeClient() !== null,
  });
}

export async function getAppsService(): Promise<AppsService> {
  return createAppsService(await getDb());
}

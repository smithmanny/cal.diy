import "@tanstack/react-start/server-only";

import process from "node:process";
import type { Database } from "@calcom/db/database";
import { IS_PRODUCTION_BUILD } from "../build";
import { pickMessages } from "../catalog";
import { getDb } from "../db";
import { PushRepository } from "./PushRepository";
import { PushService } from "./PushService";

/** Web push is on when VAPID keys are set (`npx web-push generate-vapid-keys`). */
export function isPushEnabled(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function createPushService(db: Database): PushService | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  const publicUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return new PushService(new PushRepository(db), {
    // Push services contact this address about misbehaving senders; the site URL is allowed too.
    vapid: { publicKey, privateKey, subject: process.env.VAPID_SUBJECT ?? publicUrl },
    publicUrl,
    allowInsecureEndpoints: !IS_PRODUCTION_BUILD,
    loadMessages: pickMessages,
  });
}

export async function getPushService(): Promise<PushService | null> {
  return createPushService(await getDb());
}

import "@tanstack/react-start/server-only";

import { env, waitUntil } from "cloudflare:workers";
import process from "node:process";
import type { Database } from "@calcom/db/database";
import { createD1Database } from "@calcom/db/drivers/d1";

let db: Database | undefined;

export async function getDb(): Promise<Database> {
  db ??= createD1Database(env.DB);
  return db;
}

/** Reads a file from the static assets (public/) bundle, or null when it doesn't exist. */
export async function readStaticAsset(path: string): Promise<string | null> {
  const response = await env.ASSETS.fetch(new Request(`https://assets.local/${path}`));
  return response.ok ? response.text() : null;
}

/** Keeps the Worker alive until `promise` settles, without delaying the response. */
export function runInBackground(promise: Promise<unknown>): void {
  waitUntil(promise.catch((error) => console.error("Background task failed", error)));
}

/** Workers can't open SMTP connections; use RESEND_API_KEY for email on Cloudflare. */
export function createSmtpSender(): null {
  if (process.env.EMAIL_SERVER_HOST)
    console.warn("EMAIL_SERVER_HOST is ignored on Cloudflare Workers; set RESEND_API_KEY instead.");
  return null;
}

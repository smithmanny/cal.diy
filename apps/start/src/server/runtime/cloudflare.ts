import "@tanstack/react-start/server-only";

import { env } from "cloudflare:workers";
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

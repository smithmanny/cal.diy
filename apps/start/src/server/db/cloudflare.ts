import { env } from "cloudflare:workers";
import type { Database } from "@calcom/db/database";
import { createD1Database } from "@calcom/db/drivers/d1";

let db: Database | undefined;

export async function getDb(): Promise<Database> {
  db ??= createD1Database(env.DB);
  return db;
}

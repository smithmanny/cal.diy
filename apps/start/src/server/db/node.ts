import { resolve } from "node:path";
import process from "node:process";
import type { Database } from "@calcom/db/database";
import { createLibsqlDatabase, migrateLibsqlDatabase } from "@calcom/db/drivers/libsql";

// The server is bundled into dist/, so resolve from the working directory (apps/start).
const DEFAULT_MIGRATIONS_DIR = resolve(process.cwd(), "../../packages/db/migrations");

let dbPromise: Promise<Database> | undefined;

async function init(): Promise<Database> {
  const options = {
    url: process.env.DATABASE_URL ?? "file:./data/cal.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  };
  // Self-hosted installs have no separate deploy step, so the schema is brought up to date
  // on boot. Set RUN_MIGRATIONS=false to manage migrations yourself.
  if (process.env.RUN_MIGRATIONS !== "false") {
    await migrateLibsqlDatabase(options, process.env.MIGRATIONS_DIR ?? DEFAULT_MIGRATIONS_DIR);
  }
  return createLibsqlDatabase(options);
}

export function getDb(): Promise<Database> {
  dbPromise ??= init().catch((error) => {
    dbPromise = undefined;
    throw error;
  });
  return dbPromise;
}

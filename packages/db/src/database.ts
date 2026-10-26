import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as relations from "./relations";
import * as tables from "./schema";

export const schema = { ...tables, ...relations };
export type Schema = typeof schema;

/**
 * Driver-agnostic handle shared by Cloudflare D1 and libSQL/SQLite (Docker).
 *
 * D1 does not support interactive transactions (`db.transaction`), so writes that must be
 * atomic go through `db.batch([...])`, which both drivers execute as a single transaction.
 */
export type Database = BaseSQLiteDatabase<"async", unknown, Schema> &
  Pick<DrizzleD1Database<Schema>, "batch">;

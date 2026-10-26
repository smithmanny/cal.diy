import { is } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/d1";
import { SQLiteRaw } from "drizzle-orm/sqlite-core/query-builders/raw";
import { type Database, schema } from "../database";

/**
 * Drizzle's D1 batch() reads `stmt` off every prepared query, but raw `db.run(sql)` queries with
 * bound parameters have none, so the batch throws before reaching D1. Raw queries are how
 * conditionalInsert makes check-then-insert atomic, so give each one a real D1 statement.
 */
function preparedForD1Batch(binding: D1Database, raw: SQLiteRaw<unknown>): BatchItem<"sqlite"> {
  const query = raw.getQuery();
  const prepared = {
    getQuery: () => query,
    stmt: binding.prepare(query.sql),
    mapResult: (result: unknown) => result,
  };
  // Duck-typed to the three members D1's batch() uses; there is no public way to build one.
  return { _prepare: () => prepared } as unknown as BatchItem<"sqlite">;
}

export function createD1Database(binding: D1Database): Database {
  const db = drizzle(binding, { schema });
  const batch = db.batch.bind(db);
  db.batch = ((queries: BatchItem<"sqlite">[]) =>
    batch(
      queries.map((query) => (is(query, SQLiteRaw) ? preparedForD1Batch(binding, query) : query)) as [
        BatchItem<"sqlite">,
        ...BatchItem<"sqlite">[],
      ]
    )) as typeof db.batch;
  return db;
}

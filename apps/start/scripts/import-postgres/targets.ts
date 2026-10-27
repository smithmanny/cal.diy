import type { Database } from "@calcom/db/database";
import { chunkRowsForInsert } from "@calcom/db/insert-chunks";
import { type Column, eq, getTableColumns } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { drizzle as queryBuilder } from "drizzle-orm/sqlite-proxy";
import type { TargetRow } from "./convert";
import type { ImportTarget } from "./importer";

function idColumn(table: SQLiteTable): Column {
  const id = getTableColumns(table).id;
  if (!id) throw new Error("Only tables with an id column can reference themselves");
  return id;
}

// Built statements only; this database is never executed.
const builder = queryBuilder(async () => ({ rows: [] }));

function insertStatements(table: SQLiteTable, rows: TargetRow[], keepExisting: boolean) {
  return chunkRowsForInsert(table, rows).map((chunk) => {
    const insert = builder.insert(table).values(chunk);
    return keepExisting ? insert.onConflictDoNothing() : insert;
  });
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString("hex")}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** Writes straight into a libSQL / SQLite database (a local file for Docker). */
export function libsqlTarget(db: Database): ImportTarget {
  return {
    async insert(table, rows, { keepExisting }) {
      const statements = chunkRowsForInsert(table, rows).map((chunk) => {
        const insert = db.insert(table).values(chunk);
        return keepExisting ? insert.onConflictDoNothing() : insert;
      });
      const [first, ...rest] = statements;
      if (first) await db.batch([first, ...rest] as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
    },
    async setColumn(table, key, value, id) {
      await db
        .update(table)
        .set({ [key]: value })
        .where(eq(idColumn(table), id));
    },
  };
}

/** Replaces each `?` placeholder outside quoted names and strings with its value. */
export function inlineParams(query: string, params: unknown[]): string {
  let output = "";
  let quote: string | null = null;
  let next = 0;
  for (const char of query) {
    if (quote) {
      if (char === quote) quote = null;
      output += char;
    } else if (char === "'" || char === '"' || char === "`") {
      quote = char;
      output += char;
    } else if (char === "?") {
      output += sqlLiteral(params[next++]);
    } else {
      output += char;
    }
  }
  if (next !== params.length) throw new Error(`Expected ${params.length} placeholders, found ${next}`);
  return output;
}

/**
 * Writes SQL statements for `wrangler d1 execute --file`, for D1 databases the import can't
 * reach directly. Run it against a database that already has the migrations applied.
 */
export function sqlFileTarget(write: (statement: string) => void): ImportTarget {
  // D1 checks foreign keys at the end of the import rather than per statement.
  write("PRAGMA defer_foreign_keys = true;");
  const add = (query: { sql: string; params: unknown[] }) =>
    write(`${inlineParams(query.sql, query.params)};`);
  return {
    async insert(table, rows, { keepExisting }) {
      for (const statement of insertStatements(table, rows, keepExisting)) add(statement.toSQL());
    },
    async setColumn(table, key, value, id) {
      add(
        builder
          .update(table)
          .set({ [key]: value })
          .where(eq(idColumn(table), id))
          .toSQL()
      );
    },
  };
}

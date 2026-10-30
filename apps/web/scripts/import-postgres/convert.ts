import { type Column, getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

/** A row as Postgres `row_to_json` returns it, keyed by database column name. */
type SourceRow = Record<string, unknown>;
/** Insert values for a Drizzle table, keyed by the schema's property names. */
type TargetRow = Record<string, unknown>;

const TIME_OF_DAY = /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_ZONE = /(Z|[+-]\d{2}(:?\d{2})?)$/;

const enumKey = (value: string) => value.replace(/[-_]/g, "").toUpperCase();

function convertValue(column: Column, value: unknown): unknown {
  switch (column.columnType) {
    case "SQLiteTimestamp":
      return value instanceof Date ? value : parsePostgresDate(String(value));
    case "SQLiteBoolean":
      // Booleans that were timestamps in Postgres (users.emailVerified) mean "true since then".
      return typeof value === "boolean" ? value : true;
    case "SQLiteTextJson":
    case "SQLiteBlobJson":
      return value;
    case "SQLiteInteger":
    case "SQLiteReal":
    case "SQLiteNumeric":
      return typeof value === "number" ? value : Number(value);
    default:
      if (column.enumValues?.length) return enumName(String(value), column.enumValues);
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

/**
 * Postgres dates as `row_to_json` prints them. Prisma's `timestamp(3)` columns hold UTC without a
 * zone; `@db.Time` values become 1970-01-01 in UTC, which is how the new schema stores times of day.
 */
export function parsePostgresDate(value: string): Date {
  if (TIME_OF_DAY.test(value)) return new Date(`1970-01-01T${value}Z`);
  if (DATE_ONLY.test(value)) return new Date(`${value}T00:00:00Z`);
  const iso = value.replace(" ", "T");
  const date = new Date(HAS_ZONE.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Unreadable date "${value}"`);
  return date;
}

/**
 * Postgres holds an enum's `@map` value ("roundRobin", "user-event-type"), SQLite its Prisma name
 * ("ROUND_ROBIN", "UserEventType"). Every `@map` in Cal's schema is the name with its case and
 * separators changed, so matching on letters alone finds the name.
 */
export function enumName(value: string, names: readonly string[]): string {
  if (names.includes(value)) return value;
  const match = names.find((name) => enumKey(name) === enumKey(value));
  if (!match) throw new Error(`"${value}" is not one of ${names.join(", ")}`);
  return match;
}

/**
 * Maps a Postgres row onto a Drizzle table by column name and type. Columns only Postgres has are
 * dropped. A column Postgres doesn't have, or a null in a NOT NULL column, gets the new default.
 */
export function convertRow(table: SQLiteTable, row: SourceRow): TargetRow {
  const converted: TargetRow = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    const value = row[column.name];
    if (value === undefined || value === null) {
      const useDefault = column.hasDefault && (value === undefined || column.notNull);
      if (!useDefault) converted[key] = null;
      continue;
    }
    try {
      converted[key] = convertValue(column, value);
    } catch (error) {
      throw new Error(`${column.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return converted;
}

export type { SourceRow, TargetRow };

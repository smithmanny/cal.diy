import { getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

/** D1 rejects any statement that binds more than 100 parameters ("too many SQL variables"). */
export const D1_MAX_BOUND_PARAMETERS = 100;

/**
 * Splits rows so each `db.insert(table).values(chunk)` stays within D1's parameter limit. Every
 * column can become a bound parameter (defaults included), so the column count is the worst case.
 */
export function chunkRowsForInsert<TTable extends SQLiteTable, TRow>(table: TTable, rows: TRow[]): TRow[][] {
  const columnCount = Object.keys(getTableColumns(table)).length;
  const rowsPerChunk = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMETERS / columnCount));
  const chunks: TRow[][] = [];
  for (let start = 0; start < rows.length; start += rowsPerChunk) {
    chunks.push(rows.slice(start, start + rowsPerChunk));
  }
  return chunks;
}

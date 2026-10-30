import { getTableColumns, is, SQL, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

/**
 * `INSERT INTO table (...) SELECT <values> WHERE <condition>` as one statement.
 *
 * D1 has no interactive transactions, so "check then insert" must happen inside a single statement
 * to be atomic. Values go through each column's $defaultFn/$onUpdate and mapToDriverValue, so the
 * row is stored exactly as `db.insert(table).values(values)` would store it.
 */
export function conditionalInsert<TTable extends SQLiteTable>(
  table: TTable,
  /** Column values; a SQL expression (e.g. a subquery) is inserted as-is. */
  values: { [K in keyof TTable["$inferInsert"]]: TTable["$inferInsert"][K] | SQL },
  condition: SQL
): SQL {
  const provided = values as Record<string, unknown>;
  const names: SQL[] = [];
  const params: SQL[] = [];
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    let value = provided[key];
    if (value === undefined) value = column.defaultFn?.() ?? column.onUpdateFn?.();
    if (value === undefined) continue;
    names.push(sql`${sql.identifier(column.name)}`);
    if (is(value, SQL)) params.push(value);
    else params.push(value === null ? sql`NULL` : sql`${column.mapToDriverValue(value)}`);
  }
  return sql`INSERT INTO ${table} (${sql.join(names, sql`, `)}) SELECT ${sql.join(params, sql`, `)} WHERE ${condition}`;
}

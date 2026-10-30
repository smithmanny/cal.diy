import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";
import { convertRow, type SourceRow, type TargetRow } from "./convert";

type StepContext = { warn: (message: string) => void };

type ImportStep = {
  /** Postgres table to read. */
  source: string;
  target: SQLiteTable;
  /** Defaults to convertRow; returning null skips the row. */
  map?: (row: SourceRow, context: StepContext) => TargetRow | null | Promise<TargetRow | null>;
  /** Postgres columns that tie a row to something not imported yet (teams), so the row is skipped. */
  skipWhenSet?: string[];
  /** The new database seeds this table (OutOfOfficeReason), so rows already there are kept. */
  keepExisting?: boolean;
};

interface RowSource {
  tables(): Promise<Set<string>>;
  rows(table: string): AsyncIterable<SourceRow>;
}

interface ImportTarget {
  insert(table: SQLiteTable, rows: TargetRow[], options: { keepExisting: boolean }): Promise<void>;
  /** Sets one column of the row whose `id` is `id`; used for references within a table. */
  setColumn(table: SQLiteTable, key: string, value: unknown, id: unknown): Promise<void>;
}

type TableReport = { source: string; table: string; imported: number; skipped: number };
type ImportReport = { tables: TableReport[]; warnings: string[] };

type Reference = {
  key: string;
  foreignTable: string;
  foreignColumn: string;
  nullable: boolean;
  self: boolean;
};

const BATCH_SIZE = 500;

function references(table: SQLiteTable): Reference[] {
  const keyByColumn = new Map(
    Object.entries(getTableColumns(table)).map(([key, column]) => [column.name, key])
  );
  const tableName = getTableName(table);
  return getTableConfig(table).foreignKeys.flatMap((foreignKey) => {
    const { columns, foreignColumns, foreignTable } = foreignKey.reference();
    // Every foreign key in the imported tables is a single column.
    if (columns.length !== 1) return [];
    const foreignTableName = getTableName(foreignTable);
    return [
      {
        key: keyByColumn.get(columns[0].name) ?? columns[0].name,
        foreignTable: foreignTableName,
        foreignColumn: foreignColumns[0].name,
        nullable: !columns[0].notNull,
        self: foreignTableName === tableName,
      },
    ];
  });
}

/**
 * Tracks the key values imported so far, per referenced table and column, so a row pointing at
 * something that wasn't imported (a team, an organization profile) drops that reference instead of
 * failing the foreign key.
 */
class ImportedKeys {
  private readonly keys = new Map<string, Set<string>>();

  constructor(steps: ImportStep[]) {
    for (const step of steps) {
      for (const reference of references(step.target)) {
        this.keys.set(`${reference.foreignTable}.${reference.foreignColumn}`, new Set());
      }
    }
  }

  record(table: SQLiteTable, row: TargetRow) {
    const tableName = getTableName(table);
    for (const [key, column] of Object.entries(getTableColumns(table))) {
      const value = row[key];
      if (value != null) this.keys.get(`${tableName}.${column.name}`)?.add(String(value));
    }
  }

  has(reference: Reference, value: unknown): boolean {
    return this.keys.get(`${reference.foreignTable}.${reference.foreignColumn}`)?.has(String(value)) ?? false;
  }
}

type Deferred = { id: unknown; key: string; value: unknown; reference: Reference };

class StepRun {
  readonly report: TableReport;
  private readonly references: Reference[];
  private readonly deferred: Deferred[] = [];
  private batch: TargetRow[] = [];

  constructor(
    private readonly step: ImportStep,
    private readonly target: ImportTarget,
    private readonly keys: ImportedKeys,
    private readonly context: StepContext
  ) {
    this.references = references(step.target);
    this.report = { source: step.source, table: getTableName(step.target), imported: 0, skipped: 0 };
  }

  async add(source: SourceRow) {
    const row = this.step.skipWhenSet?.some((column) => source[column] != null)
      ? null
      : await (this.step.map ? this.step.map(source, this.context) : convertRow(this.step.target, source));
    if (!row || !this.resolveReferences(row)) {
      this.report.skipped++;
      return;
    }
    this.keys.record(this.step.target, row);
    this.batch.push(row);
    if (this.batch.length >= BATCH_SIZE) await this.flush();
  }

  /** Clears references to rows that weren't imported; false when the row can't exist without one. */
  private resolveReferences(row: TargetRow): boolean {
    for (const reference of this.references) {
      const value = row[reference.key];
      if (value == null) continue;
      if (reference.self) {
        // The referenced row may come later in the same table, so the link is set afterwards.
        this.deferred.push({ id: row.id, key: reference.key, value, reference });
        row[reference.key] = null;
      } else if (!this.keys.has(reference, value)) {
        if (!reference.nullable) return false;
        row[reference.key] = null;
      }
    }
    return true;
  }

  async flush() {
    if (!this.batch.length) return;
    await this.target.insert(this.step.target, this.batch, { keepExisting: this.step.keepExisting ?? false });
    this.report.imported += this.batch.length;
    this.batch = [];
  }

  async finish() {
    await this.flush();
    for (const { id, key, value, reference } of this.deferred) {
      if (this.keys.has(reference, value)) await this.target.setColumn(this.step.target, key, value, id);
    }
  }
}

export async function runImport({
  source,
  target,
  steps,
  log = () => {},
}: {
  source: RowSource;
  target: ImportTarget;
  steps: ImportStep[];
  log?: (message: string) => void;
}): Promise<ImportReport> {
  const available = await source.tables();
  const keys = new ImportedKeys(steps);
  const warnings: string[] = [];
  const context: StepContext = { warn: (message) => warnings.push(message) };
  const tables: TableReport[] = [];

  for (const step of steps) {
    if (!available.has(step.source)) {
      // Older Cal versions don't have every table.
      warnings.push(`Skipped ${step.source}: not in the source database.`);
      continue;
    }
    log(`Importing ${step.source} into ${getTableName(step.target)}…`);
    const run = new StepRun(step, target, keys, context);
    for await (const row of source.rows(step.source)) {
      try {
        await run.add(row);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`${step.source} row ${JSON.stringify(row.id ?? null)}: ${reason}`);
      }
    }
    await run.finish();
    tables.push(run.report);
  }
  return { tables, warnings };
}

export type { StepContext, ImportStep, RowSource, ImportTarget, TableReport, ImportReport };

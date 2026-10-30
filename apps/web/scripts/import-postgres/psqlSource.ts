import { spawn } from "node:child_process";
import type { SourceRow } from "./convert";
import type { RowSource } from "./importer";

// Reads the old database through the `psql` client rather than a Postgres driver, so the import
// adds no dependency; psql ships with every Postgres install and image.

const SAFE_TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function* psqlRecords(databaseUrl: string, query: string): AsyncGenerator<string> {
  // -A -t: bare values; -0: records end in a NUL byte, which JSON text can't contain.
  const child = spawn(
    "psql",
    [databaseUrl, "-X", "-q", "-A", "-t", "-0", "-v", "ON_ERROR_STOP=1", "-c", query],
    {
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  let pending = "";
  let finished = false;
  try {
    for await (const chunk of child.stdout.setEncoding("utf8")) {
      pending += chunk;
      const records = pending.split("\0");
      pending = records.pop() ?? "";
      for (const record of records) {
        const text = record.trim();
        if (text) yield text;
      }
    }
    finished = true;
  } finally {
    // Stops psql when the import fails part way through a table.
    if (!finished) child.kill();
  }
  if (pending.trim()) yield pending.trim();

  const code = await exited;
  if (code !== 0) throw new Error(`psql failed (exit ${code}): ${stderr.trim()}`);
}

export function psqlSource(databaseUrl: string): RowSource {
  return {
    async tables() {
      const names = new Set<string>();
      const query =
        "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'";
      for await (const name of psqlRecords(databaseUrl, query)) names.add(name);
      return names;
    },
    async *rows(table: string) {
      if (!SAFE_TABLE_NAME.test(table)) throw new Error(`Unexpected table name "${table}"`);
      for await (const json of psqlRecords(databaseUrl, `SELECT row_to_json(t) FROM "${table}" t`)) {
        yield JSON.parse(json) as SourceRow;
      }
    },
  };
}

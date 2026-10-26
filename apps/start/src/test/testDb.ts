import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "@calcom/db/database";
import { createLibsqlDatabase, migrateLibsqlDatabase } from "@calcom/db/drivers/libsql";

const migrationsFolder = fileURLToPath(new URL("../../../../packages/db/migrations", import.meta.url));

/** A fresh, fully migrated SQLite database in the OS temp dir. */
export async function createTestDb(): Promise<Database> {
  const options = { url: `file:${join(tmpdir(), `cal-start-test-${crypto.randomUUID()}.db`)}` };
  await migrateLibsqlDatabase(options, migrationsFolder);
  return createLibsqlDatabase(options);
}

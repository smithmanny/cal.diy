import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "@calcom/db/database";
import { createLibsqlDatabase, migrateLibsqlDatabase } from "@calcom/db/drivers/libsql";
import { afterAll } from "vitest";

const migrationsFolder = fileURLToPath(new URL("../../../../packages/db/migrations", import.meta.url));

const created: string[] = [];

// Each test file gets its own copy of this module, so its databases go when its tests are done.
afterAll(async () => {
  const files = created.splice(0).flatMap((path) => [path, `${path}-wal`, `${path}-shm`, `${path}-journal`]);
  await Promise.all(files.map((file) => rm(file, { force: true })));
});

/** A fresh, fully migrated SQLite database in the OS temp dir, removed after the test file. */
export async function createTestDb(): Promise<Database> {
  const path = join(tmpdir(), `cal-start-test-${crypto.randomUUID()}.db`);
  created.push(path);
  const options = { url: `file:${path}` };
  await migrateLibsqlDatabase(options, migrationsFolder);
  return createLibsqlDatabase(options);
}

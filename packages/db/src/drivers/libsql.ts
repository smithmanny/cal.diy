import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { type Database, schema } from "../database";

type LibsqlOptions = {
  /** `file:/data/cal.db` for a local SQLite file, or a `libsql://` URL. */
  url: string;
  authToken?: string;
};

async function connect({ url, authToken }: LibsqlOptions) {
  if (url.startsWith("file:")) {
    // A fresh install (or a new Docker volume path) has no directory yet, and SQLite won't create it.
    const filePath = url.startsWith("file://") ? fileURLToPath(url) : url.slice("file:".length);
    await mkdir(dirname(filePath), { recursive: true });
  }
  const client = createClient({ url, authToken });
  if (url.startsWith("file:")) {
    // SQLite leaves foreign keys off per connection, whereas D1 always enforces them.
    await client.execute("PRAGMA foreign_keys = ON");
    // WAL lets the booking page read while a write is in flight, which matters on slow SD cards.
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA busy_timeout = 5000");
  }
  return drizzle(client, { schema });
}

export async function createLibsqlDatabase(options: LibsqlOptions): Promise<Database> {
  return connect(options);
}

export async function migrateLibsqlDatabase(options: LibsqlOptions, migrationsFolder: string): Promise<void> {
  const db = await connect(options);
  await migrate(db, { migrationsFolder });
  db.$client.close();
}

export type { LibsqlOptions };

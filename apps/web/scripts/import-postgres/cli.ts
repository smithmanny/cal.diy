import { createWriteStream } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createLibsqlDatabase, migrateLibsqlDatabase } from "@calcom/db/drivers/libsql";
import { user } from "@calcom/db/schema";
import { generateRandomString, symmetricEncrypt } from "better-auth/crypto";
import { count } from "drizzle-orm";
import { symmetricDecrypt } from "../../src/server/crypto/symmetric";
import { type ImportReport, type ImportTarget, runImport } from "./importer";
import type { TwoFactorCrypto } from "./mappers";
import { importPlan } from "./plan";
import { psqlSource } from "./psqlSource";
import { libsqlTarget, sqlFileTarget } from "./targets";

const USAGE = `Copies an existing Cal install's Postgres data into the new SQLite schema.

  yarn workspace @calcom/web import:postgres --from <postgres url> --to file:./data/cal.db
  yarn workspace @calcom/web import:postgres --from <postgres url> --sql import.sql   # for D1

Environment:
  BETTER_AUTH_SECRET       required: the new app's secret (2FA data is encrypted with it)
  CALENDSO_ENCRYPTION_KEY  the old install's key, to carry over 2FA backup codes

--to migrates the database and must find it empty. For --sql, apply the migrations to the D1
database first, then: wrangler d1 execute cal-diy --remote --file import.sql`;

const migrationsFolder = fileURLToPath(new URL("../../../../packages/db/migrations", import.meta.url));

function twoFactorCrypto(env: NodeJS.ProcessEnv): TwoFactorCrypto {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Set BETTER_AUTH_SECRET to the secret the new app will run with.");
  const calKey = env.CALENDSO_ENCRYPTION_KEY;
  return {
    decryptCal: calKey ? (text) => symmetricDecrypt(text, calKey) : null,
    encryptBetterAuth: (data) => symmetricEncrypt({ key: secret, data }),
    randomSecret: () => generateRandomString(32),
  };
}

async function openTarget(options: { to?: string; sql?: string }): Promise<{
  target: ImportTarget;
  close: () => Promise<void>;
}> {
  if (options.sql) {
    const file = createWriteStream(options.sql);
    return {
      target: sqlFileTarget((statement) => file.write(`${statement}\n`)),
      close: () =>
        new Promise((resolve, reject) =>
          file.end((error?: Error | null) => (error ? reject(error) : resolve()))
        ),
    };
  }
  if (!options.to) throw new Error("Pass --to <file:… or libsql URL> or --sql <file>.");
  const connection = { url: options.to, authToken: process.env.DATABASE_AUTH_TOKEN };
  await migrateLibsqlDatabase(connection, migrationsFolder);
  const db = await createLibsqlDatabase(connection);
  const [{ users }] = await db.select({ users: count() }).from(user);
  if (users > 0) throw new Error(`${options.to} already has users; import into a new database.`);
  // The libSQL client holds no handles that keep the process alive, so it needs no closing.
  return { target: libsqlTarget(db), close: async () => {} };
}

function printReport(report: ImportReport) {
  console.log("\nImported:");
  for (const table of report.tables) {
    const skipped = table.skipped ? `, ${table.skipped} skipped` : "";
    const label = table.source === table.table ? table.table : `${table.source} → ${table.table}`;
    console.log(`  ${label.padEnd(26)} ${table.imported}${skipped}`);
  }
  if (report.warnings.length) console.log(`\nWarnings:\n  ${report.warnings.join("\n  ")}`);
  console.log(
    "\nEveryone needs to sign in again (sessions aren't carried over). Users with 2FA sign in with a" +
      " backup code, then set up their authenticator app again in Settings › Security."
  );
}

export async function main(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      from: { type: "string" },
      to: { type: "string" },
      sql: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const from = values.from ?? process.env.SOURCE_DATABASE_URL;
  if (values.help || !from) {
    console.log(USAGE);
    process.exitCode = values.help ? 0 : 1;
    return;
  }
  const crypto = twoFactorCrypto(process.env);
  const { target, close } = await openTarget(values);
  try {
    const report = await runImport({
      source: psqlSource(from),
      target,
      steps: importPlan(crypto),
      log: console.log,
    });
    printReport(report);
  } finally {
    await close();
  }
}

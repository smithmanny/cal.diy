// Runs the TypeScript import CLI through Vite's module runner, which resolves the workspace's
// TypeScript packages (@calcom/db) without a separate build step.
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const entry = fileURLToPath(new URL("./import-postgres/cli.ts", import.meta.url));
const { module } = await runnerImport(entry, { configFile: false, logLevel: "error" });
try {
  await module.main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

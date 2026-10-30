import process from "node:process";
import { defineConfig } from "drizzle-kit";

// Migrations are plain SQLite SQL, applied by `wrangler d1 migrations apply` on Cloudflare
// and by the libSQL migrator on container start for Docker.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./local.db",
  },
});

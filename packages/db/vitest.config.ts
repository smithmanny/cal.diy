import process from "node:process";
import { defineConfig } from "vitest/config";

// Cal's scheduling code assumes a UTC process, as the app pins it (apps/web/server.node.mjs).
process.env.TZ = "UTC";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});

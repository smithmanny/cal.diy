import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { copyLocalesPlugin } from "./scripts/copy-locales.ts";

export default defineConfig({
  plugins: [copyLocalesPlugin()],
  resolve: {
    // Workspace packages (e.g. @coss/ui) would otherwise resolve the repo root's React 18.
    // Same reason as in vite.config.ts.
    dedupe: ["react", "react-dom", "@better-auth/core", "better-call"],
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
      "#runtime": fileURLToPath(new URL("./src/server/runtime/node.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    server: { deps: { inline: [/better-auth/, /better-call/] } },
  },
});

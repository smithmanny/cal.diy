import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { copyLocalesPlugin } from "./scripts/copy-locales.ts";

export default defineConfig({
  plugins: [copyLocalesPlugin()],
  resolve: {
    // Workspace packages (e.g. @coss/ui) would otherwise resolve the repo root's React 18.
    dedupe: ["react", "react-dom"],
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
      "#runtime": fileURLToPath(new URL("./src/server/runtime/node.ts", import.meta.url)),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});

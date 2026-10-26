import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { copyLocalesPlugin } from "./scripts/copy-locales.ts";

export default defineConfig({
  plugins: [copyLocalesPlugin()],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
      "#runtime": fileURLToPath(new URL("./src/server/runtime/node.ts", import.meta.url)),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});

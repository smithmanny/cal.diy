import process from "node:process";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// One codebase, two runtimes: Cloudflare Workers (D1) or Node in Docker (SQLite file).
// The only runtime-specific module is the DB driver, swapped in via the `#db-driver` alias.
const target = process.env.DEPLOY_TARGET === "cloudflare" ? "cloudflare" : "node";

export default defineConfig(({ command, mode }) => {
  // Server code reads config from process.env in both runtimes. On Node, expose .env there for
  // dev/preview (real environment variables still win); Workers get .dev.vars from wrangler instead.
  if (target === "node") {
    for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
      process.env[key] ??= value;
    }
  }

  return {
    resolve: {
      alias: {
        "#db-driver": fileURLToPath(new URL(`./src/server/db/${target}.ts`, import.meta.url)),
        "~": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    // For Docker, bundle everything except libSQL's native bindings so the runtime image only
    // installs one package, built for its own CPU (arm64 / armv7 on a Raspberry Pi). Dev keeps
    // deps external because the dev module runner cannot inline CommonJS packages like React.
    ssr:
      target === "node" && command === "build"
        ? { noExternal: true, external: ["@libsql/client"] }
        : undefined,
    plugins: [
      ...(target === "cloudflare" ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
      tanstackStart(),
      react(),
    ],
  };
});

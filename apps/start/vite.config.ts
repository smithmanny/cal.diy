import process from "node:process";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { buildEmbedPlugin } from "./scripts/build-embed.ts";
import { copyAppLogosPlugin } from "./scripts/copy-app-logos.ts";
import { copyLocalesPlugin } from "./scripts/copy-locales.ts";

// See resolve.dedupe below. Dedupe only applies to code Vite processes, so these are inlined in dev too.
const BETTER_AUTH_SHARED = ["@better-auth/core", "better-call"];
const BETTER_AUTH_INLINE = [/^better-auth/, /^@better-auth\//, /^better-call/];

// One codebase, two runtimes: Cloudflare Workers (D1) or Node in Docker (SQLite file).
// Runtime-specific code (DB driver, static file reads) lives in src/server/runtime/, swapped in via `#runtime`.
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
      // Workspace packages (e.g. @coss/ui) would otherwise resolve the repo root's React 18. Better
      // Auth's core and better-call are installed twice (better-auth nests its own next to zod 4,
      // since the repo root still has zod 3; @better-auth/api-key gets the hoisted one). Loading one
      // copy keeps a single module state and doesn't bundle them twice.
      dedupe: ["react", "react-dom", ...BETTER_AUTH_SHARED],
      alias: {
        "#runtime": fileURLToPath(new URL(`./src/server/runtime/${target}.ts`, import.meta.url)),
        "~": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    // For Docker, bundle everything except libSQL's native bindings so the runtime image only
    // installs one package, built for its own CPU (arm64 / armv7 on a Raspberry Pi). Dev keeps
    // deps external because the dev module runner cannot inline CommonJS packages like React.
    ssr:
      target === "node" && command === "build"
        ? { noExternal: true, external: ["@libsql/client"] }
        : { noExternal: BETTER_AUTH_INLINE },
    plugins: [
      copyLocalesPlugin(),
      buildEmbedPlugin(),
      copyAppLogosPlugin(),
      tailwindcss(),
      ...(target === "cloudflare" ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
      tanstackStart(),
      react(),
    ],
  };
});

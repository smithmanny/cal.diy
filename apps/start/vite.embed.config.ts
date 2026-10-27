import path from "node:path";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Builds Cal's embed snippet library (packages/embeds/embed-core) into public/embed/embed.js, so
// sites keep using Cal's `Cal("init", ...)` snippet against this app. The library is unchanged;
// only its build moves here, since embed-core's own build needs Cal's Next.js toolchain.
const embedCore = path.resolve(import.meta.dirname, "../../packages/embeds/embed-core");

export default defineConfig({
  root: embedCore,
  plugins: [tailwindcss()],
  // embed-core's own PostCSS config names plugins this app does not install.
  css: { postcss: {} },
  resolve: {
    alias: [
      // embed-core's build generates this file with the Tailwind CLI; the Vite plugin does it here.
      { find: "./tailwind.generated.css?inline", replacement: path.join(embedCore, "src/styles.css?inline") },
    ],
  },
  define: {
    // Snippets pass their origin to Cal("init"); this is only the fallback.
    "process.env.EMBED_PUBLIC_WEBAPP_URL": JSON.stringify(process.env.BETTER_AUTH_URL ?? ""),
    "process.env.EMBED_PUBLIC_VERCEL_URL": JSON.stringify(""),
    "process.env.EMBED_PUBLIC_EMBED_FINGER_PRINT": JSON.stringify(process.env.EMBED_FINGER_PRINT ?? ""),
    "process.env.EMBED_PUBLIC_EMBED_VERSION": JSON.stringify("1.5.3"),
    "process.env.INTEGRATION_TEST_MODE": JSON.stringify(""),
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "public/embed"),
    emptyOutDir: true,
    lib: {
      entry: path.join(embedCore, "src/embed.ts"),
      formats: ["iife"],
      name: "CalEmbedLibrary",
      fileName: () => "embed.js",
    },
  },
});

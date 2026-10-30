import { fileURLToPath } from "node:url";
import { build, type Plugin } from "vite";

const CONFIG_FILE = fileURLToPath(new URL("../vite.embed.config.ts", import.meta.url));

let built: Promise<void> | undefined;

/** Builds public/embed/embed.js (Cal's snippet library) from vite.embed.config.ts. */
export function buildEmbed(): Promise<void> {
  built ??= build({ configFile: CONFIG_FILE, logLevel: "warn" }).then(() => undefined);
  return built;
}

export function buildEmbedPlugin(): Plugin {
  return {
    name: "cal:build-embed",
    // Once per process: `buildStart` runs for each environment (client and server).
    buildStart: buildEmbed,
  };
}

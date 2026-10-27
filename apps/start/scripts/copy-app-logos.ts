import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { APPS } from "../src/lib/apps.ts";

const APP_STORE = fileURLToPath(new URL("../../../packages/app-store/", import.meta.url));
const PUBLIC = fileURLToPath(new URL("../public/app-store/", import.meta.url));

let copied: Promise<void> | undefined;

/** Copies each app's logo from packages/app-store into public/app-store/<dirName>/. */
export function copyAppLogos(): Promise<void> {
  copied ??= Promise.all(
    APPS.map(async (app) => {
      await mkdir(`${PUBLIC}${app.dirName}`, { recursive: true });
      await copyFile(`${APP_STORE}${app.dirName}/static/${app.logo}`, `${PUBLIC}${app.dirName}/${app.logo}`);
    })
  ).then(() => undefined);
  return copied;
}

export function copyAppLogosPlugin(): Plugin {
  return {
    name: "cal:copy-app-logos",
    // Once per process: `buildStart` runs for each environment (client and server).
    buildStart: copyAppLogos,
  };
}

import { copyFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const LOCALES_DIR = fileURLToPath(new URL("../../../packages/i18n/locales", import.meta.url));
const OUT_DIR = fileURLToPath(new URL("../public/locales", import.meta.url));

/**
 * Copies packages/i18n/locales/<lang>/common.json to public/locales/<lang>.json. The catalogs are
 * served as static assets and read per request, because bundling all 44 (~14 MB) would exceed
 * the Workers script size limit.
 */
export async function copyLocales(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const entries = await readdir(LOCALES_DIR, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => copyFile(`${LOCALES_DIR}/${entry.name}/common.json`, `${OUT_DIR}/${entry.name}.json`))
  );
}

export function copyLocalesPlugin(): Plugin {
  return {
    name: "cal:copy-locales",
    // `buildStart` runs for both `vite dev` and `vite build`, before public/ is read.
    buildStart: copyLocales,
  };
}

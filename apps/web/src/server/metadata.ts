import type { JsonValue } from "@calcom/db/ids";

type Metadata = { [key: string]: JsonValue };

/** A metadata column (EventType, users) as an object; Cal keeps app settings and more in it, so writers must merge. */
export function parseMetadata(value: unknown): Metadata {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Metadata) } : {};
}

/** Sets or (for null) removes metadata keys, keeping everything else. */
export function mergeMetadata(value: unknown, changes: { [key: string]: JsonValue | null }): Metadata {
  const metadata = parseMetadata(value);
  for (const [key, changed] of Object.entries(changes)) {
    if (changed === null) delete metadata[key];
    else metadata[key] = changed;
  }
  return metadata;
}

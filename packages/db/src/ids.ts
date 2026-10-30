let counter = 0;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// Prisma's cuid() and uuid(7) were generated client-side by the Prisma engine,
// so we reproduce them in JS rather than relying on SQLite (which has neither).
export function uuidv7(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const timestamp = BigInt(Date.now());
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((timestamp >> BigInt(8 * (5 - i))) & 0xffn);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function cuid(): string {
  counter = (counter + 1) % 1679616;
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12);
  return `c${Date.now().toString(36)}${counter.toString(36).padStart(4, "0")}${random}`;
}

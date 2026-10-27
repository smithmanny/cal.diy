async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  return Array.from(signature, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HMAC-signed OAuth state binding the callback to the user who started it, valid for 10 minutes. */
export async function signState(userId: number, secret: string, now = Date.now()): Promise<string> {
  const payload = `${userId}.${now + 10 * 60_000}.${crypto.randomUUID()}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyState(state: string, secret: string, now = Date.now()): Promise<number | null> {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [userId, expires, nonce, signature] = parts;
  const expected = await hmac(secret, `${userId}.${expires}.${nonce}`);
  if (!timingSafeEqual(signature, expected) || Number(expires) < now) return null;
  return Number(userId);
}

// Stripe's webhook signatures (https://docs.stripe.com/webhooks#verify-manually) on WebCrypto, so
// they verify on Workers: `Stripe-Signature: t=<seconds>,v1=<hex HMAC-SHA256 of "t.payload">`.

const encoder = new TextEncoder();

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** A header for `payload`, as Stripe would send it; for tests and the fake Stripe. */
export async function signStripePayload(payload: string, secret: string, now = Date.now()): Promise<string> {
  const timestamp = Math.floor(now / 1000);
  return `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${payload}`)}`;
}

/**
 * Whether `header` signs this exact payload with `secret`, recently enough (Stripe's default
 * tolerance is five minutes) that a captured request can't be replayed later.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  now = Date.now(),
  toleranceSeconds = 300
): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.split("=", 2) as [string, string | undefined]);
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!Number.isFinite(timestamp) || !signatures.length) return false;
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = await hmacHex(secret, `${timestamp}.${payload}`);
  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

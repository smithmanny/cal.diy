/**
 * HS256 JSON Web Tokens with WebCrypto, so they work on Workers. Same format as the
 * `jsonwebtoken` package Cal signed its OAuth tokens with, so tokens Cal issued keep working.
 */

type Claims = Record<string, unknown>;

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    usage,
  ]);
}

export async function signJwt(claims: Claims, secret: string, expiresInSeconds: number, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const header = base64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(encoder.encode(JSON.stringify({ ...claims, iat, exp: iat + expiresInSeconds })));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, "sign"),
    encoder.encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${base64url(new Uint8Array(signature))}`;
}

/** The token's claims if it is a well-formed HS256 token with a valid signature that hasn't expired. */
export async function verifyJwt(token: string, secret: string, now = Date.now()): Promise<Claims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  try {
    const { alg } = JSON.parse(new TextDecoder().decode(fromBase64url(header)));
    if (alg !== "HS256") return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, "verify"),
      fromBase64url(signature),
      encoder.encode(`${header}.${payload}`)
    );
    if (!valid) return null;
    const claims: unknown = JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
    if (typeof claims !== "object" || claims === null || Array.isArray(claims)) return null;
    const exp = (claims as Claims).exp;
    if (typeof exp === "number" && exp * 1000 <= now) return null;
    return claims as Claims;
  } catch {
    return null;
  }
}

/** RFC 7636 S256: base64url(sha256(verifier)). */
export async function codeChallengeOf(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
}

/** Cal stores OAuth client secrets as hex SHA-256 digests. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

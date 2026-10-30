/**
 * Web Push with WebCrypto only, so it runs on Workers as well as Node: VAPID (RFC 8292) signs the
 * request, and the payload is encrypted with aes128gcm (RFC 8291 over RFC 8188).
 */

type Bytes = Uint8Array<ArrayBuffer>;

/** A browser's PushSubscription as JSON: where to send, and the keys to encrypt for. */
type PushSubscriptionJson = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Base64url keys, as `web-push generate-vapid-keys` prints them. */
type VapidKeys = { publicKey: string; privateKey: string };

const RECORD_SIZE = 4096;
const encoder = new TextEncoder();

function bytes(length: number): Bytes {
  return new Uint8Array(new ArrayBuffer(length));
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = bytes(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function base64UrlDecode(value: string): Bytes {
  const binary = atob(
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=")
  );
  const out = bytes(binary.length);
  for (let index = 0; index < binary.length; index++) out[index] = binary.charCodeAt(index);
  return out;
}

function base64UrlEncode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A P-256 key as JWK from its raw uncompressed public point (65 bytes) and optional private scalar. */
function p256Jwk(publicKey: Uint8Array, privateKey?: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 4)
    throw new Error("Expected an uncompressed P-256 public key");
  return {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
    ...(privateKey ? { d: base64UrlEncode(privateKey) } : {}),
    ext: true,
  };
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey("raw", concat(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: concat(salt), info: concat(info) },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

type SenderKeys = { publicKey: Bytes; privateKey: CryptoKey };

async function newSenderKeys(): Promise<SenderKeys> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  return {
    publicKey: new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)),
    privateKey: pair.privateKey,
  };
}

/** Fixed sender keys, for reproducing RFC 8291's example; real sends use a fresh pair each time. */
async function importSenderKeys(publicKey: string, privateKey: string): Promise<SenderKeys> {
  const raw = base64UrlDecode(publicKey);
  const key = await crypto.subtle.importKey(
    "jwk",
    p256Jwk(raw, base64UrlDecode(privateKey)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );
  return { publicKey: raw, privateKey: key };
}

/** The aes128gcm body for one push message (a single record). */
async function encryptPayload(
  payload: Uint8Array,
  subscription: PushSubscriptionJson["keys"],
  options: { salt?: Uint8Array; sender?: SenderKeys } = {}
): Promise<Bytes> {
  const receiverPublic = base64UrlDecode(subscription.p256dh);
  const authSecret = base64UrlDecode(subscription.auth);
  const salt = options.salt ?? crypto.getRandomValues(bytes(16));
  const sender = options.sender ?? (await newSenderKeys());
  const receiverKey = await crypto.subtle.importKey(
    "jwk",
    p256Jwk(receiverPublic),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: receiverKey }, sender.privateKey, 256)
  );
  const keyInfo = concat(encoder.encode("WebPush: info\0"), receiverPublic, sender.publicKey);
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);
  const contentKey = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  // A single, last record: the payload then the 0x02 delimiter.
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(payload, Uint8Array.of(2)))
  );
  const header = bytes(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = sender.publicKey.length;
  return concat(header, sender.publicKey, ciphertext);
}

/** The VAPID Authorization header for a push service's origin, valid for 12 hours. */
async function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  subject: string,
  now = Date.now()
): Promise<string> {
  const publicKey = base64UrlDecode(keys.publicKey);
  const signingKey = await crypto.subtle.importKey(
    "jwk",
    p256Jwk(publicKey, base64UrlDecode(keys.privateKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64UrlEncode(
    encoder.encode(
      JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })
    )
  );
  // WebCrypto's ECDSA signature is already the raw r||s form JWTs use.
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signingKey,
      encoder.encode(`${header}.${claims}`)
    )
  );
  return `vapid t=${header}.${claims}.${base64UrlEncode(signature)}, k=${keys.publicKey}`;
}

/** The request that delivers `payload` to one subscription. */
async function buildPushRequest(
  subscription: PushSubscriptionJson,
  payload: string,
  vapid: VapidKeys & { subject: string },
  ttlSeconds = 24 * 3600
): Promise<{ url: string; init: RequestInit & { headers: Record<string, string>; body: Bytes } }> {
  const body = await encryptPayload(encoder.encode(payload), subscription.keys);
  return {
    url: subscription.endpoint,
    init: {
      method: "POST",
      headers: {
        authorization: await vapidAuthorization(subscription.endpoint, vapid, vapid.subject),
        "content-encoding": "aes128gcm",
        "content-type": "application/octet-stream",
        ttl: String(ttlSeconds),
        urgency: "high",
      },
      body,
    },
  };
}

export {
  base64UrlDecode,
  base64UrlEncode,
  buildPushRequest,
  encryptPayload,
  importSenderKeys,
  vapidAuthorization,
};
export type { PushSubscriptionJson, VapidKeys };

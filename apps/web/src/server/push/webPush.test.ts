import { describe, expect, it } from "vitest";
import {
  base64UrlDecode,
  base64UrlEncode,
  buildPushRequest,
  encryptPayload,
  importSenderKeys,
  vapidAuthorization,
} from "./webPush";

// RFC 8291, Appendix A.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  senderPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  senderPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  receiverPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  receiverPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

async function vapidPair() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { publicKey: base64UrlEncode(publicRaw), privateKey: jwk.d ?? "", verifyKey: pair.publicKey };
}

describe("encryptPayload", () => {
  it("reproduces RFC 8291's example message", async () => {
    const body = await encryptPayload(
      new TextEncoder().encode(RFC.plaintext),
      { p256dh: RFC.receiverPublic, auth: RFC.authSecret },
      { salt: base64UrlDecode(RFC.salt), sender: await importSenderKeys(RFC.senderPublic, RFC.senderPrivate) }
    );
    expect(base64UrlEncode(body)).toBe(RFC.body);
  });

  it("uses a fresh salt and sender key for every message", async () => {
    const keys = { p256dh: RFC.receiverPublic, auth: RFC.authSecret };
    const payload = new TextEncoder().encode("hi");
    const [first, second] = await Promise.all([encryptPayload(payload, keys), encryptPayload(payload, keys)]);
    expect(base64UrlEncode(first.slice(0, 16))).not.toBe(base64UrlEncode(second.slice(0, 16)));
    expect(first[20]).toBe(65);
  });
});

describe("vapidAuthorization", () => {
  it("signs an ES256 JWT for the push service's origin", async () => {
    const keys = await vapidPair();
    const now = Date.UTC(2030, 0, 1);
    const header = await vapidAuthorization("https://push.example.com/send/abc", keys, "mailto:a@b.co", now);
    const match = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
    expect(match?.[4]).toBe(keys.publicKey);
    const [, head, claims, signature] = match ?? [];
    expect(JSON.parse(new TextDecoder().decode(base64UrlDecode(claims)))).toEqual({
      aud: "https://push.example.com",
      exp: now / 1000 + 12 * 3600,
      sub: "mailto:a@b.co",
    });
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keys.verifyKey,
      base64UrlDecode(signature),
      new TextEncoder().encode(`${head}.${claims}`)
    );
    expect(valid).toBe(true);
  });
});

describe("buildPushRequest", () => {
  it("posts the encrypted payload with the push headers", async () => {
    const keys = await vapidPair();
    const request = await buildPushRequest(
      { endpoint: "https://push.example.com/x", keys: { p256dh: RFC.receiverPublic, auth: RFC.authSecret } },
      '{"title":"Hi"}',
      { ...keys, subject: "mailto:a@b.co" }
    );
    expect(request.url).toBe("https://push.example.com/x");
    expect(request.init.headers).toMatchObject({
      "content-encoding": "aes128gcm",
      ttl: "86400",
      authorization: expect.stringMatching(/^vapid t=/),
    });
    // Header (21) + sender key (65) + payload (14) + delimiter (1) + tag (16).
    expect(request.init.body.length).toBe(21 + 65 + 14 + 1 + 16);
  });
});

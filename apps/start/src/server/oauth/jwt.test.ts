import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { codeChallengeOf, sha256Hex, signJwt, verifyJwt } from "./jwt";

const SECRET = "test-encryption-key";
const NOW = Date.UTC(2030, 0, 1);

/** A token signed the way `jsonwebtoken` does it, built with node:crypto as an independent check. */
function nodeSignedToken(claims: object, secret = SECRET): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${part({ alg: "HS256", typ: "JWT" })}.${part(claims)}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

describe("jwt", () => {
  it("signs tokens other HS256 implementations accept, with iat and exp", async () => {
    const token = await signJwt({ userId: 7 }, SECRET, 1800, NOW);
    const [header, payload, signature] = token.split(".");
    expect(createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url")).toBe(signature);
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      userId: 7,
      iat: NOW / 1000,
      exp: NOW / 1000 + 1800,
    });
  });

  it("verifies tokens signed elsewhere, like the ones Cal issued", async () => {
    const token = nodeSignedToken({ userId: 7, token_type: "Access Token", exp: NOW / 1000 + 60 });
    expect(await verifyJwt(token, SECRET, NOW)).toMatchObject({ userId: 7, token_type: "Access Token" });
  });

  it("rejects a wrong secret, a changed payload, expiry and other algorithms", async () => {
    const token = await signJwt({ userId: 7 }, SECRET, 60, NOW);
    expect(await verifyJwt(token, "other-secret", NOW)).toBeNull();
    const [header, , signature] = token.split(".");
    const forged = `${header}.${Buffer.from(JSON.stringify({ userId: 1 })).toString("base64url")}.${signature}`;
    expect(await verifyJwt(forged, SECRET, NOW)).toBeNull();
    expect(await verifyJwt(token, SECRET, NOW + 61_000)).toBeNull();
    const none = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${token.split(".")[1]}.`;
    expect(await verifyJwt(none, SECRET, NOW)).toBeNull();
    expect(await verifyJwt("not-a-token", SECRET, NOW)).toBeNull();
  });

  it("computes PKCE S256 challenges and Cal's secret digests", async () => {
    // RFC 7636 appendix B.
    expect(await codeChallengeOf("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    );
    expect(await sha256Hex("secret")).toBe(createHash("sha256").update("secret").digest("hex"));
  });
});

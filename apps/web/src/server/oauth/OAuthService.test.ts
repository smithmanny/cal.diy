import type { Database } from "@calcom/db/database";
import { oAuthClient, user } from "@calcom/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { codeChallengeOf } from "./jwt";
import { OAuthRepository } from "./OAuthRepository";
import { OAuthService, parseScopes } from "./OAuthService";

const REDIRECT = "https://app.example/callback?x=1";
const VERIFIER = "a-long-random-code-verifier-a-long-random-code-verifier";

let db: Database;
let now: Date;
let service: OAuthService;
let userId: number;

beforeEach(async () => {
  db = await createTestDb();
  now = new Date("2030-01-01T00:00:00Z");
  service = new OAuthService({ repo: new OAuthRepository(db), secret: "key", now: () => now });
  [{ id: userId }] = await db.insert(user).values({ email: "ada@example.com" }).returning({ id: user.id });
});

async function codeFor(
  clientId: string,
  extra: { codeChallenge?: string; codeChallengeMethod?: string } = {}
) {
  const url = new URL(
    await service.authorize({
      clientId,
      redirectUri: REDIRECT,
      userId,
      scopes: ["READ_PROFILE"],
      state: "s1",
      ...extra,
    })
  );
  expect(url.searchParams.get("state")).toBe("s1");
  expect(url.searchParams.get("x")).toBe("1");
  return url.searchParams.get("code") ?? "";
}

describe("OAuthService", () => {
  it("issues tokens for a code once, to a confidential client with its secret", async () => {
    const { clientId, clientSecret } = await service.createClient({
      name: "App",
      redirectUri: REDIRECT,
      logo: null,
      clientType: "CONFIDENTIAL",
      userId,
    });
    const [stored] = await db.select().from(oAuthClient).where(eq(oAuthClient.clientId, clientId));
    expect(stored.clientSecret).not.toBe(clientSecret);

    const code = await codeFor(clientId);
    await expect(
      service.exchangeCode({ clientId, code, redirectUri: REDIRECT, clientSecret: "wrong" })
    ).rejects.toMatchObject({ error: "invalid_client" });
    const tokens = await service.exchangeCode({
      clientId,
      code,
      redirectUri: REDIRECT,
      clientSecret: clientSecret ?? "",
    });
    expect(tokens).toMatchObject({ token_type: "bearer", expires_in: 1800 });
    expect(await service.verifyAccessToken(tokens.access_token)).toEqual({
      userId,
      clientId,
      scope: ["READ_PROFILE"],
    });
    // A refresh token isn't an access token.
    expect(await service.verifyAccessToken(tokens.refresh_token)).toBeNull();

    await expect(
      service.exchangeCode({ clientId, code, redirectUri: REDIRECT, clientSecret: clientSecret ?? "" })
    ).rejects.toMatchObject({ error: "invalid_grant" });

    const refreshed = await service.refresh({
      clientId,
      refreshToken: tokens.refresh_token,
      clientSecret: clientSecret ?? "",
    });
    expect(await service.verifyAccessToken(refreshed.access_token)).toMatchObject({ userId });
  });

  it("requires PKCE from public clients and checks the verifier", async () => {
    const { clientId, clientSecret } = await service.createClient({
      name: "SPA",
      redirectUri: REDIRECT,
      logo: null,
      clientType: "PUBLIC",
      userId,
    });
    expect(clientSecret).toBeNull();
    await expect(codeFor(clientId)).rejects.toMatchObject({ description: "pkce_required" });
    const codeChallenge = await codeChallengeOf(VERIFIER);
    const code = await codeFor(clientId, { codeChallenge, codeChallengeMethod: "S256" });
    await expect(
      service.exchangeCode({ clientId, code, redirectUri: REDIRECT, codeVerifier: "wrong" })
    ).rejects.toMatchObject({ error: "invalid_grant", description: "pkce_verification_failed" });
    const again = await codeFor(clientId, { codeChallenge, codeChallengeMethod: "S256" });
    const tokens = await service.exchangeCode({
      clientId,
      code: again,
      redirectUri: REDIRECT,
      codeVerifier: VERIFIER,
    });
    expect(await service.verifyAccessToken(tokens.access_token)).toMatchObject({ userId });
  });

  it("refuses unknown clients, other redirect URIs and expired codes", async () => {
    const { clientId, clientSecret } = await service.createClient({
      name: "App",
      redirectUri: REDIRECT,
      logo: null,
      clientType: "CONFIDENTIAL",
      userId,
    });
    await expect(service.clientForAuthorization("nope", REDIRECT)).rejects.toMatchObject({
      error: "unauthorized_client",
    });
    await expect(service.clientForAuthorization(clientId, "https://evil.example/cb")).rejects.toMatchObject({
      description: "redirect_uri_mismatch",
    });
    const code = await codeFor(clientId);
    now = new Date(now.getTime() + 11 * 60_000);
    await expect(
      service.exchangeCode({ clientId, code, redirectUri: REDIRECT, clientSecret: clientSecret ?? "" })
    ).rejects.toMatchObject({ description: "code_invalid_or_expired" });
  });

  it("keeps only the scopes Cal knows", () => {
    expect(parseScopes("READ_PROFILE,READ_BOOKING admin")).toEqual(["READ_BOOKING", "READ_PROFILE"]);
    expect(parseScopes(undefined)).toEqual([]);
  });
});

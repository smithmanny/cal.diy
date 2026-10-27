import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { symmetricDecrypt, symmetricEncrypt } from "../../src/server/crypto/symmetric";
import {
  apiKeyDigest,
  mapApiKey,
  mapNextAuthAccount,
  mapUser,
  mapUserPassword,
  type TwoFactorCrypto,
  twoFactorFromUser,
} from "./mappers";

const CAL_KEY = "0123456789abcdef0123456789abcdef";

function crypto(overrides: Partial<TwoFactorCrypto> = {}): TwoFactorCrypto {
  return {
    decryptCal: (text) => symmetricDecrypt(text, CAL_KEY),
    encryptBetterAuth: async (text) => `enc(${text})`,
    randomSecret: () => "fresh-secret",
    ...overrides,
  };
}

describe("mapUser", () => {
  it("leaves the old 2FA columns empty, since the secret moves to TwoFactor", () => {
    const row = mapUser({
      id: 1,
      email: "a@example.com",
      twoFactorEnabled: true,
      twoFactorSecret: "x",
      backupCodes: "y",
    });
    expect(row).toMatchObject({ twoFactorEnabled: true, twoFactorSecret: null, backupCodes: null });
  });
});

describe("mapNextAuthAccount", () => {
  it("renames NextAuth's columns and converts expires_at from seconds", () => {
    expect(
      mapNextAuthAccount({
        id: "cuid",
        userId: 2,
        type: "oauth",
        provider: "google",
        providerAccountId: "sub-2",
        access_token: "ya29",
        refresh_token: "1//r",
        id_token: null,
        expires_at: 1767225600,
        scope: "openid email",
        token_type: "Bearer",
      })
    ).toEqual({
      userId: 2,
      providerId: "google",
      accountId: "sub-2",
      accessToken: "ya29",
      refreshToken: "1//r",
      idToken: null,
      accessTokenExpiresAt: new Date("2026-01-01T00:00:00Z"),
      scope: "openid email",
    });
  });
});

describe("mapUserPassword", () => {
  it("makes Better Auth's credential account, keeping the bcrypt hash", () => {
    expect(mapUserPassword({ userId: 5, hash: "$2a$10$abc" })).toEqual({
      userId: 5,
      providerId: "credential",
      accountId: "5",
      password: "$2a$10$abc",
    });
  });
});

describe("mapApiKey", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const hashedKey = createHash("sha256").update(secret).digest("hex");

  it("re-encodes Cal's hex digest the way Better Auth hashes keys", () => {
    expect(apiKeyDigest(hashedKey)).toBe(createHash("sha256").update(secret).digest("base64url"));
  });

  it("keeps a personal key with its owner, note and dates", () => {
    expect(
      mapApiKey({
        id: "key1",
        userId: 1,
        teamId: null,
        note: "Zapier",
        hashedKey,
        expiresAt: null,
        lastUsedAt: "2024-05-05T05:05:05",
        createdAt: "2024-01-01T00:00:00",
      })
    ).toMatchObject({
      referenceId: "1",
      name: "Zapier",
      prefix: "cal_",
      key: apiKeyDigest(hashedKey),
      expiresAt: null,
      lastRequest: new Date("2024-05-05T05:05:05Z"),
      createdAt: new Date("2024-01-01T00:00:00Z"),
    });
  });

  it("skips team keys", () => {
    expect(mapApiKey({ id: "key2", userId: 1, teamId: 3, hashedKey })).toBeNull();
  });
});

describe("twoFactorFromUser", () => {
  it("carries over the unused backup codes with Better Auth's dash, under a fresh secret", async () => {
    const backupCodes = await symmetricEncrypt(JSON.stringify(["abcde12345", null, "fghij67890"]), CAL_KEY);
    const warn = vi.fn();
    const row = await twoFactorFromUser({ id: 1, twoFactorEnabled: true, backupCodes }, crypto(), warn);
    expect(row).toEqual({
      userId: 1,
      secret: "enc(fresh-secret)",
      backupCodes: 'enc(["abcde-12345","fghij-67890"])',
      verified: true,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("skips users without 2FA", async () => {
    expect(await twoFactorFromUser({ id: 1, twoFactorEnabled: false }, crypto(), vi.fn())).toBeNull();
  });

  it("warns about a user who would be locked out", async () => {
    const warn = vi.fn();
    const row = await twoFactorFromUser(
      { id: 9, twoFactorEnabled: true, backupCodes: "iv:cipher" },
      crypto({ decryptCal: null }),
      warn
    );
    expect(row?.backupCodes).toBe("enc([])");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("User 9"));
  });
});

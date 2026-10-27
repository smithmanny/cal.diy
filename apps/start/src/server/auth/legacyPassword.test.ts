import { hashPassword } from "better-auth/crypto";
import { describe, expect, it, vi } from "vitest";
import { createPasswordVerifier } from "./legacyPassword";

const BCRYPT_HASH = "$2b$04$yxyWVCgn3e8lTFpsV1iN6O32k5hMuBjoOZma/JYlrNNHtUE7SRcOW"; // "Password123"

describe("createPasswordVerifier", () => {
  it("accepts an imported bcrypt hash and upgrades it to scrypt", async () => {
    const replaceHash = vi.fn(async () => {});
    const verify = createPasswordVerifier(replaceHash);

    expect(await verify({ hash: BCRYPT_HASH, password: "Password123" })).toBe(true);
    expect(replaceHash).toHaveBeenCalledWith(BCRYPT_HASH, expect.not.stringMatching(/^\$2/));

    const [, upgraded] = replaceHash.mock.calls[0] as unknown as [string, string];
    expect(await verify({ hash: upgraded, password: "Password123" })).toBe(true);
  });

  it("rejects a wrong password without touching the stored hash", async () => {
    const replaceHash = vi.fn(async () => {});
    expect(await createPasswordVerifier(replaceHash)({ hash: BCRYPT_HASH, password: "nope" })).toBe(false);
    expect(replaceHash).not.toHaveBeenCalled();
  });

  it("still signs the user in when the upgrade can't be saved", async () => {
    const verify = createPasswordVerifier(async () => {
      throw new Error("database is locked");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await verify({ hash: BCRYPT_HASH, password: "Password123" })).toBe(true);
  });

  it("checks Better Auth's own hashes as before", async () => {
    const replaceHash = vi.fn(async () => {});
    const verify = createPasswordVerifier(replaceHash);
    const hash = await hashPassword("Password123");
    expect(await verify({ hash, password: "Password123" })).toBe(true);
    expect(await verify({ hash, password: "Password124" })).toBe(false);
    expect(replaceHash).not.toHaveBeenCalled();
  });
});

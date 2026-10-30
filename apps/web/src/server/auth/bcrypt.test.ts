import { describe, expect, it } from "vitest";
import { isBcryptHash, verifyBcrypt } from "./bcrypt";

// Hashes made with the reference implementation (pyca/bcrypt 5.0).
const VECTORS: [password: string, hash: string][] = [
  ["", "$2b$04$DVHQzk9APFnTHjC6qa6PW.BOslEX4eoC64mg4mozZfZh6HJlIU2Di"],
  ["Password123", "$2b$04$yxyWVCgn3e8lTFpsV1iN6O32k5hMuBjoOZma/JYlrNNHtUE7SRcOW"],
  ["pässwörd ✓", "$2b$05$SAxAAxxklvkEJUiYUldBBOHslGpOz37Nwe4Zwg95JoYhf7I0y9upG"],
  ["Calcom-12345", "$2a$10$mtBBsOokmtT9dCJ/dH2sze/iXNQrfy1F2XDqxsstarO/sLOwlwdNe"],
];

describe("verifyBcrypt", () => {
  it.each(VECTORS)("accepts the right password for %j", (password, hash) => {
    expect(verifyBcrypt(password, hash)).toBe(true);
  });

  it.each(VECTORS)("rejects a wrong password for %j", (password, hash) => {
    expect(verifyBcrypt(`${password}x`, hash)).toBe(false);
  });

  it("ignores everything after the 72nd byte, like every bcrypt", () => {
    const hash = "$2b$04$SPMK7GckYv7mTHK2BUmbAuSp7.APxfoT7UO9fBBNEjsdXaoRmQpdS";
    expect(verifyBcrypt("a".repeat(72), hash)).toBe(true);
    expect(verifyBcrypt("a".repeat(80), hash)).toBe(true);
    expect(verifyBcrypt("a".repeat(71), hash)).toBe(false);
  });

  it("treats the $2y$ prefix like $2b$", () => {
    expect(verifyBcrypt("Password123", "$2y$04$yxyWVCgn3e8lTFpsV1iN6O32k5hMuBjoOZma/JYlrNNHtUE7SRcOW")).toBe(
      true
    );
  });

  it("rejects malformed hashes instead of throwing", () => {
    expect(verifyBcrypt("Password123", "not-a-hash")).toBe(false);
    expect(verifyBcrypt("Password123", "$2b$03$yxyWVCgn3e8lTFpsV1iN6O32k5hMuBjoOZma/JYlrNNHtUE7SRcOW")).toBe(
      false
    );
  });
});

describe("isBcryptHash", () => {
  it("tells bcrypt hashes from Better Auth's scrypt ones", () => {
    expect(isBcryptHash(VECTORS[1][1])).toBe(true);
    expect(isBcryptHash("6f1c2b3a4d5e6f70:9a8b7c6d5e4f")).toBe(false);
  });
});

import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { symmetricDecrypt, symmetricEncrypt } from "./symmetric";

const KEY = "0123456789abcdef0123456789abcdef";

// Cal's implementation from packages/lib/crypto.ts, inlined to prove the formats interoperate.
function calEncrypt(text: string, key: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes256", Buffer.from(key, "latin1"), iv);
  return `${iv.toString("hex")}:${cipher.update(text, "utf8", "hex")}${cipher.final("hex")}`;
}
function calDecrypt(text: string, key: string) {
  const [iv, ...rest] = text.split(":");
  const decipher = crypto.createDecipheriv("aes256", Buffer.from(key, "latin1"), Buffer.from(iv, "hex"));
  return decipher.update(rest.join(":"), "hex", "utf8") + decipher.final("utf8");
}

describe("symmetric encryption", () => {
  const secret = JSON.stringify({ refresh_token: "1//abc", note: "ünïcödé" });

  it("round-trips", async () => {
    expect(await symmetricDecrypt(await symmetricEncrypt(secret, KEY), KEY)).toBe(secret);
  });

  it("decrypts what Cal encrypted and Cal decrypts what this encrypts", async () => {
    expect(await symmetricDecrypt(calEncrypt(secret, KEY), KEY)).toBe(secret);
    expect(calDecrypt(await symmetricEncrypt(secret, KEY), KEY)).toBe(secret);
  });

  it("rejects keys that aren't 32 characters", async () => {
    await expect(symmetricEncrypt("x", "short")).rejects.toThrow(/32 characters/);
  });
});

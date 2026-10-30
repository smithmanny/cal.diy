import { describe, expect, it } from "vitest";
import { normalizeBackupCode } from "./backup-codes";

describe("normalizeBackupCode", () => {
  it("adds the dash Cal let people leave out", () => {
    expect(normalizeBackupCode(" abcde12345 ")).toBe("abcde-12345");
  });

  it("leaves codes with the dash, and anything else, as typed", () => {
    expect(normalizeBackupCode("abcde-12345")).toBe("abcde-12345");
    expect(normalizeBackupCode("123456")).toBe("123456");
  });
});

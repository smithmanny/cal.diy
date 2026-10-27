import { describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { BookerVerificationService } from "./BookerVerificationService";
import { VerificationRepository } from "./VerificationRepository";

async function setup() {
  const sent: { email: string; code: string; locale: string }[] = [];
  const service = new BookerVerificationService({
    repo: new VerificationRepository(await createTestDb()),
    secret: "test-secret",
    sendCode: async (email, code, locale) => void sent.push({ email, code, locale }),
  });
  return { service, sent };
}

describe("BookerVerificationService", () => {
  it("emails a 6-digit code that verifies the same address, in any case", async () => {
    const { service, sent } = await setup();
    await service.send("Greta@Example.com", "de");
    expect(sent).toEqual([
      { email: "Greta@Example.com", code: expect.stringMatching(/^\d{6}$/), locale: "de" },
    ]);
    await expect(service.verify("greta@example.com", sent[0].code)).resolves.toBeUndefined();
    await expect(service.verify("other@example.com", sent[0].code)).rejects.toMatchObject({
      code: "invalid_verification_code",
      values: { field: "verificationCode" },
    });
  });

  it("limits sends and wrong guesses per address", async () => {
    const { service, sent } = await setup();
    for (let i = 0; i < 3; i++) await service.send("a@example.com", "en");
    await expect(service.send("a@example.com", "en")).rejects.toMatchObject({ code: "too_many_attempts" });
    await service.send("b@example.com", "en");

    const wrong = sent[0].code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++)
      await expect(service.verify("a@example.com", wrong)).rejects.toMatchObject({
        code: "invalid_verification_code",
      });
    await expect(service.verify("a@example.com", sent[0].code)).rejects.toMatchObject({
      code: "too_many_attempts",
    });
  });

  it("refuses to send without an email provider", async () => {
    const service = new BookerVerificationService({
      repo: new VerificationRepository(await createTestDb()),
      secret: "s",
      sendCode: null,
    });
    await expect(service.send("a@example.com", "en")).rejects.toMatchObject({ code: "something_went_wrong" });
  });
});

import { describe, expect, it } from "vitest";
import { authErrorKey, safeCallbackUrl } from "./auth-errors";

describe("authErrorKey", () => {
  it("maps Better Auth codes to translation keys", () => {
    expect(authErrorKey({ code: "INVALID_EMAIL_OR_PASSWORD" })).toBe("incorrect_email_password");
    expect(authErrorKey({ code: "USER_ALREADY_EXISTS" })).toBe("email_already_used");
  });

  it("passes our own translation-key codes through", () => {
    expect(authErrorKey({ code: "USERNAME_ALREADY_TAKEN" })).toBe("username_already_taken");
    expect(authErrorKey({ message: "invalid_password_hint" })).toBe("invalid_password_hint");
  });

  it("falls back to a generic message", () => {
    expect(authErrorKey({ code: "SOMETHING_NEW" })).toBe("something_went_wrong");
    expect(authErrorKey(null)).toBe("something_went_wrong");
  });
});

describe("safeCallbackUrl", () => {
  it("accepts same-origin paths", () => {
    expect(safeCallbackUrl("/bookings/upcoming?x=1")).toBe("/bookings/upcoming?x=1");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    undefined,
    42,
  ])("rejects %s", (value) => {
    expect(safeCallbackUrl(value)).toBe("/event-types");
  });
});

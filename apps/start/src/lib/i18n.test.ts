import { describe, expect, it } from "vitest";
import { pickMessages } from "../server/i18n";
import { createT } from "./i18n";

describe("createT", () => {
  it("interpolates {{values}} and falls back to the key", () => {
    const t = createT({ signed_in_as: "Signed in as {{name}}" });
    expect(t("signed_in_as", { name: "Jane" })).toBe("Signed in as Jane");
    expect(t("missing_key")).toBe("missing_key");
  });
});

describe("pickMessages", () => {
  it("returns only the requested keys, including dotted nested ones", () => {
    const picked = pickMessages(["sign_in", "booking_audit_action.created", "not_a_key"]);
    expect(Object.keys(picked).sort()).toEqual(["booking_audit_action.created", "sign_in"]);
    expect(picked.sign_in).toBe("Sign in");
  });
});

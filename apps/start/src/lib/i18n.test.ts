import { describe, expect, it } from "vitest";
import { pickMessages } from "../server/catalog";
import { createT } from "./i18n";
import { localeDirection, localeFromAcceptLanguage, matchLocale } from "./locales";

describe("createT", () => {
  it("interpolates {{values}} and falls back to the key", () => {
    const t = createT({ signed_in_as: "Signed in as {{name}}" });
    expect(t("signed_in_as", { name: "Jane" })).toBe("Signed in as Jane");
    expect(t("missing_key")).toBe("missing_key");
  });
});

describe("pickMessages", () => {
  it("returns only the requested keys, including dotted nested ones", async () => {
    const picked = await pickMessages("en", ["sign_in", "booking_audit_action.created", "not_a_key"]);
    expect(Object.keys(picked).sort()).toEqual(["booking_audit_action.created", "sign_in"]);
    expect(picked.sign_in).toBe("Sign in");
  });

  it("translates into the requested locale", async () => {
    expect((await pickMessages("de", ["sign_in"])).sign_in).toBe("Anmelden");
  });

  it("falls back to English for unknown locales", async () => {
    expect((await pickMessages("xx", ["sign_in"])).sign_in).toBe("Sign in");
  });
});

describe("locale negotiation", () => {
  it("matches region variants and Chinese to shipped locales", () => {
    expect(matchLocale("de-AT")).toBe("de");
    expect(matchLocale("pt-BR")).toBe("pt-BR");
    expect(matchLocale("zh")).toBe("zh-CN");
    expect(matchLocale("xx")).toBeNull();
  });

  it("honors Accept-Language q-values", () => {
    expect(localeFromAcceptLanguage("xx;q=1, fr;q=0.5, de;q=0.8")).toBe("de");
    expect(localeFromAcceptLanguage("*")).toBeNull();
    expect(localeFromAcceptLanguage(undefined)).toBeNull();
  });

  it("knows right-to-left locales", () => {
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("he")).toBe("rtl");
    expect(localeDirection("en")).toBe("ltr");
  });
});

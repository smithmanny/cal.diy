import { describe, expect, it } from "vitest";
import { pickMessages } from "../server/catalog";
import { createT, nestedKeys } from "./i18n";
import { localeDirection, localeFromAcceptLanguage, matchLocale } from "./locales";

describe("createT", () => {
  it("resolves i18next nesting, with options and interpolated keys", () => {
    const t = createT({
      multiple_duration_mins: "{{count}} $t(minute_timeUnit)",
      multiple_duration_timeUnit: "{{count}} $t({{unit}}_timeUnit)",
      minute_timeUnit: "mins",
      hour_timeUnit: "hours",
      redirecting: 'Redirecting in $t(second, {"count": {{seconds}} })',
      second_one: "{{count}} second",
      second_other: "{{count}} seconds",
    });
    expect(t("multiple_duration_mins", { count: 45 })).toBe("45 mins");
    expect(t("multiple_duration_timeUnit", { count: 2, unit: "hour" })).toBe("2 hours");
    expect(t("redirecting", { seconds: 1 })).toBe("Redirecting in 1 second");
    expect(nestedKeys("{{count}} $t(minute_timeUnit) $t(second, {})")).toEqual(["minute_timeUnit", "second"]);
  });

  it("interpolates {{values}} and falls back to the key", () => {
    const t = createT({ signed_in_as: "Signed in as {{name}}" });
    expect(t("signed_in_as", { name: "Jane" })).toBe("Signed in as Jane");
    expect(t("missing_key")).toBe("missing_key");
  });

  it("picks i18next plural variants by the locale's rules", () => {
    const messages = {
      bookings_count_one: "{{count}} booking",
      bookings_count_other: "{{count}} bookings",
    };
    expect(createT(messages)("bookings_count", { count: 1 })).toBe("1 booking");
    expect(createT(messages)("bookings_count", { count: 3 })).toBe("3 bookings");
    // Arabic has a "few" category; without that variant, "other" applies.
    expect(createT(messages, "ar")("bookings_count", { count: 3 })).toBe("3 bookings");
  });
});

describe("pickMessages", () => {
  it("brings along the messages a message nests", async () => {
    const picked = await pickMessages("en", ["multiple_duration_mins"]);
    expect(picked.minute_timeUnit).toBe("mins");
    expect(createT(picked)("multiple_duration_mins", { count: 15 })).toBe("15 mins");
  });

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

  it("brings a key's plural variants along", async () => {
    const picked = await pickMessages("en", ["holiday_booking_conflict_warning"]);
    expect(createT(picked)("holiday_booking_conflict_warning", { count: 2 })).toBe(
      "You have 2 bookings on holidays"
    );
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

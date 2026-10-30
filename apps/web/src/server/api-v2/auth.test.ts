import { describe, expect, it } from "vitest";
import { oauthScopeFor } from "./auth";

describe("oauthScopeFor", () => {
  it("lets OAuth tokens read bookings with READ_BOOKING and the rest with READ_PROFILE, never write", () => {
    expect(oauthScopeFor("GET", "/api/v2/bookings")).toBe("READ_BOOKING");
    expect(oauthScopeFor("GET", "/api/v2/bookings/abc")).toBe("READ_BOOKING");
    expect(oauthScopeFor("GET", "/api/v2/me")).toBe("READ_PROFILE");
    expect(oauthScopeFor("GET", "/api/v2/event-types")).toBe("READ_PROFILE");
    expect(oauthScopeFor("POST", "/api/v2/bookings")).toBeNull();
    expect(oauthScopeFor("PATCH", "/api/v2/me")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { signState, verifyState } from "../../apps/oauthState";
import { FAKE_ENDPOINTS } from "./fakeGoogle";
import { buildAuthorizeUrl } from "./oauth";

const config = {
  clientId: "client",
  clientSecret: "secret",
  redirectUri: "https://cal.test/cb",
  endpoints: FAKE_ENDPOINTS,
};

describe("Google OAuth helpers", () => {
  it("asks for offline calendar access with consent", () => {
    const url = new URL(buildAuthorizeUrl(config, "state-1"));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "client",
      redirect_uri: "https://cal.test/cb",
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      state: "state-1",
    });
    expect(url.searchParams.get("scope")).toContain("calendar.events");
  });

  it("verifies its own state and rejects tampering and expiry", async () => {
    const now = 1_000_000;
    const state = await signState(42, "k", now);
    expect(await verifyState(state, "k", now)).toBe(42);
    expect(await verifyState(state, "other-key", now)).toBeNull();
    expect(await verifyState(state.replace(/^42\./, "43."), "k", now)).toBeNull();
    expect(await verifyState(state, "k", now + 11 * 60_000)).toBeNull();
    expect(await verifyState("garbage", "k", now)).toBeNull();
  });
});

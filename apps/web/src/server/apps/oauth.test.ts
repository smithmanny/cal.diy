import { describe, expect, it } from "vitest";
import { createFakeAppsState, FAKE_APP_PATHS, fakeAppsFetch } from "./fakeApps";
import { buildOAuthAuthorizeUrl, exchangeOAuthCode, type OAuthClientConfig, OAuthSession } from "./oauth";

const zoom: OAuthClientConfig = {
  clientId: "zoom-client",
  clientSecret: "zoom-secret",
  redirectUri: "https://cal.test/api/integrations/zoomvideo/callback",
  authorizeUrl: `https://apps.test${FAKE_APP_PATHS.zoomOAuth}/authorize`,
  tokenUrl: `https://apps.test${FAKE_APP_PATHS.zoomOAuth}/token`,
  scopes: [],
  clientAuth: "basic",
  expiryUnit: "ms",
};

describe("OAuth helpers", () => {
  it("builds the consent URL, leaving scope out when the provider's app settings hold it", () => {
    const url = new URL(buildOAuthAuthorizeUrl(zoom, "state-1"));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "zoom-client",
      redirect_uri: zoom.redirectUri,
      response_type: "code",
      state: "state-1",
    });
    const withScopes = new URL(buildOAuthAuthorizeUrl({ ...zoom, scopes: ["a", "b"] }, "s"));
    expect(withScopes.searchParams.get("scope")).toBe("a b");
  });

  it("sends Zoom's client in a Basic header and keeps its expiry in milliseconds", async () => {
    const state = createFakeAppsState();
    const tokens = await exchangeOAuthCode(zoom, "code-1", fakeAppsFetch(state));
    expect(state.tokenRequests[0].authorization).toBe(`Basic ${btoa("zoom-client:zoom-secret")}`);
    expect(state.tokenRequests[0].params).not.toHaveProperty("client_secret");
    expect(tokens.expiry_date).toBeGreaterThan(Date.now() + 3_500_000);
  });

  it("only refreshes a token that is about to expire, keeping the refresh token when none comes back", async () => {
    const state = createFakeAppsState();
    const stored: unknown[] = [];
    const fresh = new OAuthSession(
      { access_token: "a", refresh_token: "r", expiry_date: Date.now() + 3_600_000 },
      zoom,
      async (tokens) => void stored.push(tokens),
      fakeAppsFetch(state)
    );
    expect(await fresh.accessToken()).toBe("a");
    expect(state.tokenRequests).toHaveLength(0);

    const expiring = new OAuthSession(
      { access_token: "a", refresh_token: "r", expiry_date: Date.now() + 30_000 },
      zoom,
      async (tokens) => void stored.push(tokens),
      fakeAppsFetch(state)
    );
    expect(await expiring.accessToken()).toMatch(/^at-/);
    expect(state.tokenRequests[0].params).toMatchObject({ grant_type: "refresh_token", refresh_token: "r" });
    expect(stored).toHaveLength(1);
  });

  it("fails without a refresh token rather than using an expired one", async () => {
    const session = new OAuthSession({ access_token: "a", expiry_date: 0 }, zoom, async () => {});
    await expect(session.accessToken()).rejects.toThrow(/refresh token/);
  });
});

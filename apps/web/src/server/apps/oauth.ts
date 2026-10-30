/** Fetch-based OAuth 2.0 authorization-code flow for Microsoft and Zoom (Google has its own helpers). */

/** Cal's credential.key shape for OAuth apps: the token response plus when it expires. */
type OAuthTokens = {
  access_token: string;
  refresh_token?: string;
  /** Milliseconds or seconds since the epoch, depending on the provider (see `expiryUnit`). */
  expiry_date: number;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

type OAuthClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  authorizeParams?: Record<string, string>;
  /** Zoom wants the client in a Basic header; Microsoft wants it in the form body. */
  clientAuth: "basic" | "body";
  /** Cal stores Microsoft's expiry in seconds and Zoom's in milliseconds; kept so data stays portable. */
  expiryUnit: "ms" | "s";
};

async function tokenRequest(
  config: OAuthClientConfig,
  params: Record<string, string>,
  fetchImpl: typeof fetch
): Promise<OAuthTokens> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const body = new URLSearchParams(params);
  if (config.clientAuth === "basic") {
    headers.Authorization = `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`;
  } else {
    body.set("client_id", config.clientId);
    body.set("client_secret", config.clientSecret);
    body.set("scope", config.scopes.join(" "));
  }
  const response = await fetchImpl(config.tokenUrl, { method: "POST", headers, body });
  if (!response.ok) throw new Error(`OAuth token request failed with ${response.status}`);
  const json = (await response.json()) as Omit<OAuthTokens, "expiry_date"> & { expires_in: number };
  const expiresAt = Date.now() + json.expires_in * 1000;
  return {
    ...json,
    expiry_date: config.expiryUnit === "s" ? Math.round(expiresAt / 1000) : Math.round(expiresAt),
  };
}

export type { OAuthClientConfig, OAuthTokens };

export function buildOAuthAuthorizeUrl(config: OAuthClientConfig, state: string): string {
  const url = new URL(config.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    ...(config.scopes.length && { scope: config.scopes.join(" ") }),
    state,
    ...config.authorizeParams,
  }).toString();
  return url.toString();
}

export function exchangeOAuthCode(
  config: OAuthClientConfig,
  code: string,
  fetchImpl: typeof fetch = fetch
): Promise<OAuthTokens> {
  return tokenRequest(
    config,
    { grant_type: "authorization_code", code, redirect_uri: config.redirectUri },
    fetchImpl
  );
}

export function expiresAtMs(config: Pick<OAuthClientConfig, "expiryUnit">, tokens: OAuthTokens): number {
  return config.expiryUnit === "s" ? tokens.expiry_date * 1000 : tokens.expiry_date;
}

/**
 * Hands out a valid access token, refreshing it a minute before it expires and reporting the new
 * tokens through `onTokens` so they can be stored.
 */
export class OAuthSession {
  constructor(
    private tokens: OAuthTokens,
    private readonly config: OAuthClientConfig,
    private readonly onTokens: (tokens: OAuthTokens) => Promise<void>,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async accessToken(): Promise<string> {
    if (expiresAtMs(this.config, this.tokens) - Date.now() >= 60_000) return this.tokens.access_token;
    if (!this.tokens.refresh_token) throw new Error("OAuth credential has no refresh token");
    const refreshed = await tokenRequest(
      this.config,
      { grant_type: "refresh_token", refresh_token: this.tokens.refresh_token },
      this.fetchImpl
    );
    this.tokens = { ...refreshed, refresh_token: refreshed.refresh_token ?? this.tokens.refresh_token };
    await this.onTokens(this.tokens);
    return this.tokens.access_token;
  }

  /** A JSON request with the bearer token; listed statuses (e.g. 404 on delete) count as done. */
  async request<T>(
    url: string,
    init: { method: string; body?: unknown; headers?: Record<string, string> },
    okStatuses: number[] = []
  ): Promise<T> {
    const response = await this.fetchImpl(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (okStatuses.includes(response.status)) return {} as T;
    if (!response.ok) throw new Error(`${init.method} ${url.split("?")[0]} failed with ${response.status}`);
    if (response.status === 204) return {} as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  }
}

import "@tanstack/react-start/server-only";
import { type AccessScope, accessScopeValues, type OAuthClientType } from "@calcom/db/enums";
import { codeChallengeOf, randomHex, randomToken, sha256Hex, signJwt, verifyJwt } from "./jwt";
import type { OAuthRepository } from "./OAuthRepository";

/** An OAuth 2.0 error (RFC 6749 section 5.2), answered as `{ error, error_description }`. */
class OAuthError extends Error {
  constructor(
    readonly error: string,
    readonly description: string,
    readonly status: 400 | 401 | 404 = 400
  ) {
    super(error);
  }
}

type OAuthTokens = {
  access_token: string;
  token_type: "bearer";
  refresh_token: string;
  expires_in: number;
};

type TokenClaims = { userId: number; scope: AccessScope[]; clientId: string };

const ACCESS_TOKEN_SECONDS = 30 * 60;
const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
const CODE_MS = 10 * 60 * 1000;

type Deps = {
  repo: OAuthRepository;
  /** Cal signs its tokens with CALENDSO_ENCRYPTION_KEY; null when it isn't set. */
  secret: string | null;
  now?: () => Date;
};

function parseScopes(scope: string | null | undefined): AccessScope[] {
  const requested = (scope ?? "").split(/[\s,]+/).filter(Boolean);
  return accessScopeValues.filter((value) => requested.includes(value));
}

/**
 * Cal's OAuth 2.0 provider: authorization codes with PKCE, and JWT access and refresh tokens in
 * Cal's claim format (`userId`, `scope`, `token_type`, `clientId`).
 */
class OAuthService {
  constructor(private readonly deps: Deps) {}

  async clientForAuthorization(clientId: string, redirectUri: string) {
    const client = await this.deps.repo.findClient(clientId);
    if (!client) throw new OAuthError("unauthorized_client", "client_not_found", 404);
    if (client.status !== "APPROVED") throw new OAuthError("unauthorized_client", "client_not_approved", 401);
    if (client.redirectUri !== redirectUri) throw new OAuthError("invalid_request", "redirect_uri_mismatch");
    return {
      clientId: client.clientId,
      name: client.name,
      logo: client.logo,
      redirectUri: client.redirectUri,
    };
  }

  async authorize(input: {
    clientId: string;
    redirectUri: string;
    userId: number;
    scopes: AccessScope[];
    state?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }): Promise<string> {
    const client = await this.deps.repo.findClient(input.clientId);
    await this.clientForAuthorization(input.clientId, input.redirectUri);
    if (input.codeChallenge && input.codeChallengeMethod !== "S256")
      throw new OAuthError("invalid_request", "invalid_code_challenge_method");
    // Public clients can't keep a secret, so they must prove possession with PKCE.
    if (client?.clientType === "PUBLIC" && !input.codeChallenge)
      throw new OAuthError("invalid_request", "pkce_required");
    const code = randomToken(40);
    await this.deps.repo.createCode({
      code,
      clientId: input.clientId,
      userId: input.userId,
      scopes: input.scopes,
      expiresAt: new Date(this.now().getTime() + CODE_MS),
      codeChallenge: input.codeChallenge ?? null,
      codeChallengeMethod: input.codeChallenge ? "S256" : null,
    });
    return withParams(input.redirectUri, { code, state: input.state });
  }

  async exchangeCode(input: {
    clientId: string;
    code: string;
    redirectUri: string;
    clientSecret?: string;
    codeVerifier?: string;
  }): Promise<OAuthTokens> {
    const client = await this.authenticateClient(input.clientId, input.clientSecret);
    if (client.redirectUri !== input.redirectUri)
      throw new OAuthError("invalid_grant", "redirect_uri_mismatch");
    const found = await this.deps.repo.takeCode(input.code, input.clientId, this.now());
    if (!found?.userId) throw new OAuthError("invalid_grant", "code_invalid_or_expired");
    if (found.codeChallenge || client.clientType === "PUBLIC") {
      if (!found.codeChallenge || !input.codeVerifier)
        throw new OAuthError("invalid_request", "pkce_missing_parameters_or_invalid_method");
      if ((await codeChallengeOf(input.codeVerifier)) !== found.codeChallenge)
        throw new OAuthError("invalid_grant", "pkce_verification_failed");
    }
    return this.issueTokens({ userId: found.userId, scope: found.scopes, clientId: input.clientId });
  }

  async refresh(input: {
    clientId: string;
    refreshToken: string;
    clientSecret?: string;
  }): Promise<OAuthTokens> {
    await this.authenticateClient(input.clientId, input.clientSecret);
    const claims = await this.verify(input.refreshToken, "Refresh Token");
    if (!claims) throw new OAuthError("invalid_grant", "invalid_refresh_token");
    if (claims.clientId !== input.clientId) throw new OAuthError("invalid_grant", "client_id_mismatch");
    return this.issueTokens(claims);
  }

  /** The user and scopes an access token grants, or null if it isn't a valid one. */
  verifyAccessToken(token: string): Promise<TokenClaims | null> {
    return this.verify(token, "Access Token");
  }

  /** Admins register clients; the secret is returned once and only its hash is stored. */
  async createClient(input: {
    name: string;
    redirectUri: string;
    logo: string | null;
    clientType: OAuthClientType;
    userId: number;
  }): Promise<{ clientId: string; clientSecret: string | null }> {
    const clientId = randomHex(32);
    const clientSecret = input.clientType === "CONFIDENTIAL" ? randomHex(32) : null;
    await this.deps.repo.createClient({
      ...input,
      clientId,
      hashedSecret: clientSecret ? await sha256Hex(clientSecret) : null,
    });
    return { clientId, clientSecret };
  }

  listClients() {
    return this.deps.repo.listClients();
  }

  deleteClient(clientId: string): Promise<void> {
    return this.deps.repo.deleteClient(clientId);
  }

  private async authenticateClient(clientId: string, clientSecret: string | undefined) {
    const client = await this.deps.repo.findClient(clientId);
    if (!client) throw new OAuthError("invalid_client", "client_not_found", 401);
    if (client.status !== "APPROVED") throw new OAuthError("unauthorized_client", "client_not_approved", 401);
    if (client.clientType === "CONFIDENTIAL") {
      const stored = await this.deps.repo.findClientSecretHash(clientId);
      if (!clientSecret || !stored || (await sha256Hex(clientSecret)) !== stored)
        throw new OAuthError("invalid_client", "invalid_client_credentials", 401);
    }
    return client;
  }

  private async issueTokens(claims: TokenClaims): Promise<OAuthTokens> {
    const secret = this.secret();
    const now = this.now().getTime();
    const base = { userId: claims.userId, teamId: null, scope: claims.scope, clientId: claims.clientId };
    return {
      access_token: await signJwt({ ...base, token_type: "Access Token" }, secret, ACCESS_TOKEN_SECONDS, now),
      token_type: "bearer",
      refresh_token: await signJwt(
        { ...base, token_type: "Refresh Token" },
        secret,
        REFRESH_TOKEN_SECONDS,
        now
      ),
      expires_in: ACCESS_TOKEN_SECONDS,
    };
  }

  private async verify(token: string, type: string): Promise<TokenClaims | null> {
    const claims = await verifyJwt(token, this.secret(), this.now().getTime());
    if (!claims || claims.token_type !== type) return null;
    const { userId, scope, clientId } = claims;
    if (typeof userId !== "number" || typeof clientId !== "string" || !Array.isArray(scope)) return null;
    return { userId, clientId, scope: accessScopeValues.filter((value) => scope.includes(value)) };
  }

  private secret(): string {
    if (!this.deps.secret) throw new OAuthError("server_error", "encryption_key_missing");
    return this.deps.secret;
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }
}

/** Adds query parameters to a client's redirect URI, keeping any it already has. */
function withParams(base: string, params: Record<string, string | undefined>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params))
    if (value !== undefined) url.searchParams.set(key, value);
  return url.toString();
}

export type { OAuthTokens };
export { OAuthError, parseScopes, OAuthService, withParams };

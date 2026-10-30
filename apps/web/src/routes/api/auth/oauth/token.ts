import { createFileRoute } from "@tanstack/react-router";
import { tokenResponse } from "~/server/oauth/http";
import { OAuthError } from "~/server/oauth/OAuthService";

// Cal's token endpoint path; Better Auth's own routes live beside it under /api/auth.
export const Route = createFileRoute("/api/auth/oauth/token")({
  server: {
    handlers: {
      POST: ({ request }) =>
        tokenResponse(request, (service, params) => {
          if (params.grant_type === "refresh_token")
            return service.refresh({
              clientId: params.client_id ?? "",
              refreshToken: params.refresh_token ?? "",
              clientSecret: params.client_secret,
            });
          if (params.grant_type !== "authorization_code")
            throw new OAuthError(
              "unsupported_grant_type",
              "grant_type must be authorization_code or refresh_token"
            );
          if (!params.client_id || !params.code || !params.redirect_uri)
            throw new OAuthError("invalid_request", "client_id, code and redirect_uri are required");
          return service.exchangeCode({
            clientId: params.client_id,
            code: params.code,
            redirectUri: params.redirect_uri,
            clientSecret: params.client_secret,
            codeVerifier: params.code_verifier,
          });
        }),
    },
  },
});

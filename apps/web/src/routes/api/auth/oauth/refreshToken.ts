import { createFileRoute } from "@tanstack/react-router";
import { tokenResponse } from "~/server/oauth/http";

// Cal's separate refresh endpoint, kept for clients built against it.
export const Route = createFileRoute("/api/auth/oauth/refreshToken")({
  server: {
    handlers: {
      POST: ({ request }) =>
        tokenResponse(request, (service, params) =>
          service.refresh({
            clientId: params.client_id ?? "",
            refreshToken: params.refresh_token ?? "",
            clientSecret: params.client_secret,
          })
        ),
    },
  },
});

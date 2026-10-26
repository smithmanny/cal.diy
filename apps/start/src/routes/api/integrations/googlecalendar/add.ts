import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "~/server/auth/auth";
import { googleOAuthConfig, oauthStateSecret } from "~/server/calendars/container";
import { buildAuthorizeUrl, signState } from "~/server/calendars/google/oauth";

export const Route = createFileRoute("/api/integrations/googlecalendar/add")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await (await getAuth()).api.getSession({ headers: request.headers });
        if (!session)
          return Response.redirect(
            new URL("/auth/login?callbackUrl=%2Fsettings%2Fmy-account%2Fcalendars", request.url),
            302
          );
        const config = googleOAuthConfig();
        if (!config) return new Response("Google Calendar is not configured", { status: 404 });
        const url = buildAuthorizeUrl(config, await signState(Number(session.user.id), oauthStateSecret()));
        return Response.redirect(url, 302);
      },
    },
  },
});

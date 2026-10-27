import { createFileRoute } from "@tanstack/react-router";
import { oauthStateSecret } from "~/server/apps/config";
import { getOAuthApp } from "~/server/apps/oauthApps";
import { signState } from "~/server/apps/oauthState";
import { getAuth } from "~/server/auth/auth";
import { redirectResponse, returnCookie } from "~/server/calendars/connectReturn";

/** Starts an app's OAuth flow (Cal's /api/integrations/<app>/add, e.g. googlecalendar, zoomvideo). */
export const Route = createFileRoute("/api/integrations/$app/add")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const app = await getOAuthApp(params.app);
        if (!app) return new Response("This app is not configured", { status: 404 });
        const session = await (await getAuth()).api.getSession({ headers: request.headers });
        if (!session)
          return Response.redirect(
            new URL(`/auth/login?callbackUrl=${encodeURIComponent(app.returnTo)}`, request.url),
            302
          );
        const authorizeUrl = app.authorizeUrl(await signState(Number(session.user.id), oauthStateSecret()));
        // Onboarding passes returnTo so the user comes back to its calendar step.
        const returnTo = new URL(request.url).searchParams.get("returnTo");
        return redirectResponse(authorizeUrl, returnCookie(returnTo));
      },
    },
  },
});

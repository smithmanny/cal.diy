import { createFileRoute } from "@tanstack/react-router";
import { oauthStateSecret } from "~/server/apps/config";
import { getOAuthApp } from "~/server/apps/oauthApps";
import { verifyState } from "~/server/apps/oauthState";
import { getAuth } from "~/server/auth/auth";

function back(request: Request, path: string, error?: string) {
  const url = new URL(path, request.url);
  if (error) url.searchParams.set("error", error);
  return Response.redirect(url, 302);
}

export const Route = createFileRoute("/api/integrations/$app/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const app = await getOAuthApp(params.app);
        if (!app) return new Response("This app is not configured", { status: 404 });
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const session = await (await getAuth()).api.getSession({ headers: request.headers });
        // The signed state must name the user whose session finishes the flow, so a stolen or
        // replayed callback can't attach someone's account to another user.
        const stateUserId = await verifyState(url.searchParams.get("state") ?? "", oauthStateSecret());
        if (!session || stateUserId === null || stateUserId !== Number(session.user.id))
          return back(request, app.returnTo, "something_went_wrong");
        // No code: the user declined on the consent screen, or the provider reported an error.
        if (!code)
          return back(
            request,
            app.returnTo,
            url.searchParams.get("error") ? "something_went_wrong" : undefined
          );
        try {
          await app.connect(stateUserId, code);
        } catch (error) {
          console.error(`Connecting ${params.app} failed`, error);
          return back(request, app.returnTo, "something_went_wrong");
        }
        return back(request, app.returnTo);
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { oauthStateSecret } from "~/server/apps/config";
import { getAppsService } from "~/server/apps/container";
import { getOAuthApp } from "~/server/apps/oauthApps";
import { verifyState } from "~/server/apps/oauthState";
import { getAuth } from "~/server/auth/auth";
import { clearReturnCookie, redirectResponse, returnPath } from "~/server/calendars/connectReturn";

const TEAM_INSTALL_RETURN = "/apps";

function back(request: Request, path: string, error?: string) {
  const url = new URL(returnPath(request.headers.get("cookie"), path), request.url);
  if (error) url.searchParams.set("error", error);
  return redirectResponse(url.toString(), clearReturnCookie());
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
        const state = await verifyState(url.searchParams.get("state") ?? "", oauthStateSecret());
        if (!session || state === null || state.userId !== Number(session.user.id))
          return back(request, app.returnTo, "something_went_wrong");
        // Team installs go back to the apps page, where they're listed.
        const returnTo = state.teamId ? TEAM_INSTALL_RETURN : app.returnTo;
        // No code: the user declined on the consent screen, or the provider reported an error.
        if (!code)
          return back(request, returnTo, url.searchParams.get("error") ? "something_went_wrong" : undefined);
        try {
          // The user may have lost the team's admin role since starting the flow.
          if (state.teamId)
            await (await getAppsService()).assertTeamInstall(state.userId, state.teamId, params.app);
          await app.connect(state.teamId ? { teamId: state.teamId } : { userId: state.userId }, code);
        } catch (error) {
          console.error(`Connecting ${params.app} failed`, error);
          return back(request, returnTo, "something_went_wrong");
        }
        return back(request, returnTo);
      },
    },
  },
});

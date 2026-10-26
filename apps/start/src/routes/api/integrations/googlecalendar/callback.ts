import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "~/server/auth/auth";
import { getCalendarService, oauthStateSecret } from "~/server/calendars/container";
import { verifyState } from "~/server/calendars/google/oauth";

function backToSettings(request: Request, error?: string) {
  const url = new URL("/settings/my-account/calendars", request.url);
  if (error) url.searchParams.set("error", error);
  return Response.redirect(url, 302);
}

export const Route = createFileRoute("/api/integrations/googlecalendar/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state") ?? "";
        const session = await (await getAuth()).api.getSession({ headers: request.headers });
        // The signed state must name the user whose session finishes the flow, so a stolen or
        // replayed callback can't attach someone's calendar to another account.
        const stateUserId = await verifyState(state, oauthStateSecret());
        if (!session || stateUserId === null || stateUserId !== Number(session.user.id)) {
          return backToSettings(request, "something_went_wrong");
        }
        if (!code)
          return backToSettings(request, url.searchParams.get("error") ? "something_went_wrong" : undefined);
        const service = await getCalendarService();
        if (!service) return backToSettings(request, "something_went_wrong");
        try {
          await service.connect(stateUserId, code);
        } catch (error) {
          console.error("Connecting Google Calendar failed", error);
          return backToSettings(request, "something_went_wrong");
        }
        return backToSettings(request);
      },
    },
  },
});

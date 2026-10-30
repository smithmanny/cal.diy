import { createFileRoute } from "@tanstack/react-router";
import { getVideoService } from "~/server/video/container";
import { DAILY_VIDEO_TYPE } from "~/server/video/providers";

/**
 * Cal Video's join link (Cal's /video/<uid>): sends people to the booking's Daily room. Cal shows
 * the call in its own page; here the room's page hosts it.
 */
export const Route = createFileRoute("/video/$uid")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = await (await getVideoService())?.roomUrl(params.uid, DAILY_VIDEO_TYPE);
        if (!url)
          return Response.redirect(new URL(`/booking/${encodeURIComponent(params.uid)}`, request.url), 302);
        return Response.redirect(url, 302);
      },
    },
  },
});

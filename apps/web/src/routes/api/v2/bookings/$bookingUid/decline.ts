import { createFileRoute } from "@tanstack/react-router";
import { BOOKINGS_API_VERSION, declineBookingInputSchema } from "~/server/api-v2/bookingMapper";
import { getApiBookingService } from "~/server/api-v2/container";
import { apiRoute, parseBody } from "~/server/api-v2/http";

export const Route = createFileRoute("/api/v2/bookings/$bookingUid/decline")({
  server: {
    handlers: {
      POST: apiRoute(
        async ({ request, params, user }) => {
          const { reason } = await parseBody(request, declineBookingInputSchema);
          return (await getApiBookingService()).decide(params.bookingUid, user, false, reason ?? null);
        },
        { version: BOOKINGS_API_VERSION }
      ),
    },
  },
});

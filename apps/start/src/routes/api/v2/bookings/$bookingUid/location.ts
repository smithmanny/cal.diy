import { createFileRoute } from "@tanstack/react-router";
import { BOOKINGS_API_VERSION, updateLocationInputSchema } from "~/server/api-v2/bookingMapper";
import { getApiBookingService } from "~/server/api-v2/container";
import { apiRoute, parseBody } from "~/server/api-v2/http";

export const Route = createFileRoute("/api/v2/bookings/$bookingUid/location")({
  server: {
    handlers: {
      PATCH: apiRoute(
        async ({ request, params, user }) => {
          const input = await parseBody(request, updateLocationInputSchema);
          return (await getApiBookingService()).updateLocation(params.bookingUid, user, input);
        },
        { version: BOOKINGS_API_VERSION }
      ),
    },
  },
});

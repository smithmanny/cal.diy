import { createFileRoute } from "@tanstack/react-router";
import { addGuestsInputSchema, BOOKINGS_API_VERSION } from "~/server/api-v2/bookingMapper";
import { getApiBookingService } from "~/server/api-v2/container";
import { apiRoute, parseBody } from "~/server/api-v2/http";

export const Route = createFileRoute("/api/v2/bookings/$bookingUid/guests")({
  server: {
    handlers: {
      POST: apiRoute(
        async ({ request, params, user }) => {
          const input = await parseBody(request, addGuestsInputSchema);
          return (await getApiBookingService()).addGuests(params.bookingUid, user, input);
        },
        { version: BOOKINGS_API_VERSION }
      ),
    },
  },
});

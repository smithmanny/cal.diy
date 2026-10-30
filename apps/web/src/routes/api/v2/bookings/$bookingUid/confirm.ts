import { createFileRoute } from "@tanstack/react-router";
import { BOOKINGS_API_VERSION } from "~/server/api-v2/bookingMapper";
import { getApiBookingService } from "~/server/api-v2/container";
import { apiRoute } from "~/server/api-v2/http";

export const Route = createFileRoute("/api/v2/bookings/$bookingUid/confirm")({
  server: {
    handlers: {
      POST: apiRoute(
        async ({ params, user }) =>
          (await getApiBookingService()).decide(params.bookingUid, user, true, null),
        { version: BOOKINGS_API_VERSION }
      ),
    },
  },
});

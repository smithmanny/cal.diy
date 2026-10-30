import { createFileRoute } from "@tanstack/react-router";
import { BOOKINGS_API_VERSION } from "~/server/api-v2/bookingMapper";
import { getApiBookingService } from "~/server/api-v2/container";
import { publicApiRoute } from "~/server/api-v2/http";

export const Route = createFileRoute("/api/v2/bookings/$bookingUid/")({
  server: {
    handlers: {
      // The uid is an unguessable token handed to the attendee and host, as in Cal.
      GET: publicApiRoute(
        async ({ params, user }) => (await getApiBookingService()).get(params.bookingUid, user),
        {
          version: BOOKINGS_API_VERSION,
        }
      ),
    },
  },
});

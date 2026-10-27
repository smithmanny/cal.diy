import { createFileRoute } from "@tanstack/react-router";
import { BOOKINGS_API_VERSION, markAbsentInputSchema } from "~/server/api-v2/bookingMapper";
import { getApiBookingService } from "~/server/api-v2/container";
import { apiRoute, parseBody } from "~/server/api-v2/http";

export const Route = createFileRoute("/api/v2/bookings/$bookingUid/mark-absent")({
  server: {
    handlers: {
      POST: apiRoute(
        async ({ request, params, user }) => {
          const input = await parseBody(request, markAbsentInputSchema);
          return (await getApiBookingService()).markAbsent(params.bookingUid, user, input);
        },
        { version: BOOKINGS_API_VERSION }
      ),
    },
  },
});

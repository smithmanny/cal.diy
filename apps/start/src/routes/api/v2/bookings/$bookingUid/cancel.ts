import { createFileRoute } from "@tanstack/react-router";
import { BOOKINGS_API_VERSION, cancelBookingInputSchema } from "~/server/api-v2/bookingMapper";
import { getApiBookingService } from "~/server/api-v2/container";
import { parseBody, publicApiRoute } from "~/server/api-v2/http";

export const Route = createFileRoute("/api/v2/bookings/$bookingUid/cancel")({
  server: {
    handlers: {
      POST: publicApiRoute(
        async ({ request, params, user }) => {
          const input = await parseBody(request, cancelBookingInputSchema);
          return (await getApiBookingService()).cancel(params.bookingUid, input, user);
        },
        { version: BOOKINGS_API_VERSION }
      ),
    },
  },
});

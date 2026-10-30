import { createFileRoute } from "@tanstack/react-router";
import { BOOKINGS_API_VERSION, rescheduleBookingInputSchema } from "~/server/api-v2/bookingMapper";
import { getApiBookingService } from "~/server/api-v2/container";
import { parseBody, publicApiRoute, WithStatus } from "~/server/api-v2/http";

export const Route = createFileRoute("/api/v2/bookings/$bookingUid/reschedule")({
  server: {
    handlers: {
      POST: publicApiRoute(
        async ({ request, params, user }) => {
          const input = await parseBody(request, rescheduleBookingInputSchema);
          return new WithStatus(
            201,
            await (await getApiBookingService()).reschedule(params.bookingUid, input, user)
          );
        },
        { version: BOOKINGS_API_VERSION }
      ),
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { getApiBookingService } from "~/server/api-v2/container";
import { parseQuery, publicApiRoute } from "~/server/api-v2/http";
import { SLOTS_API_VERSION, slotsQuerySchema, slotsRange, toSlotsOutput } from "~/server/api-v2/slotsMapper";
import { getBookingService } from "~/server/bookings/container";

export const Route = createFileRoute("/api/v2/slots/")({
  server: {
    handlers: {
      GET: publicApiRoute(
        async ({ url }) => {
          const query = parseQuery(url, slotsQuerySchema);
          const { username, slug } = await (await getApiBookingService()).eventTypeLink(query);
          const bookings = await getBookingService();
          const timeZone = query.timeZone ?? "UTC";
          const slots = await bookings.getAvailableSlots({
            username,
            slug,
            ...slotsRange(query),
            timeZone,
            rescheduleUid: query.bookingUidToReschedule,
            duration: query.duration,
          });
          const length = query.duration ?? (await bookings.getPublicEvent(username, slug)).eventType.length;
          return toSlotsOutput(slots, { timeZone, format: query.format, length });
        },
        { version: SLOTS_API_VERSION }
      ),
    },
  },
});

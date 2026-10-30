import { createFileRoute } from "@tanstack/react-router";
import {
  BOOKINGS_API_VERSION,
  createBookingInputSchema,
  listBookingsQuerySchema,
} from "~/server/api-v2/bookingMapper";
import { getApiBookingService } from "~/server/api-v2/container";
import { apiRoute, parseBody, parseQuery, publicApiRoute, WithStatus } from "~/server/api-v2/http";

const version = { version: BOOKINGS_API_VERSION };

export const Route = createFileRoute("/api/v2/bookings/")({
  server: {
    handlers: {
      GET: apiRoute(async ({ url, user }) => {
        const query = parseQuery(url, listBookingsQuerySchema);
        return (await getApiBookingService()).list(user, query);
      }, version),
      // Anyone may book, as on the booking page; an API key books as its owner.
      POST: publicApiRoute(async ({ request, user }) => {
        const input = await parseBody(request, createBookingInputSchema);
        return new WithStatus(201, await (await getApiBookingService()).create(input, user));
      }, version),
    },
  },
});

import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getBookingByUid } from "~/server/bookings/functions";

/**
 * Cal's /reschedule/<uid> links (in emails and calendar events): the booker for the same event,
 * moving this booking. Any other query, like an embed's namespace, is kept.
 */
export const Route = createFileRoute("/reschedule/$uid")({
  beforeLoad: async ({ params, location }) => {
    const booking = await getBookingByUid({ data: { uid: params.uid } }).catch(() => {
      throw notFound();
    });
    const username = booking.host?.username;
    if (!username || !booking.eventType)
      throw redirect({ to: "/booking/$uid", params: { uid: params.uid }, statusCode: 302 });
    const search = new URLSearchParams(location.searchStr);
    search.set("rescheduleUid", params.uid);
    throw redirect({ href: `/${username}/${booking.eventType.slug}?${search}`, statusCode: 302 });
  },
});

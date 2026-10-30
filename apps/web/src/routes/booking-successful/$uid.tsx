import { createFileRoute, redirect } from "@tanstack/react-router";

/** Cal's older confirmation URL; the booking page is the confirmation now. */
export const Route = createFileRoute("/booking-successful/$uid")({
  beforeLoad: ({ params, location }) => {
    throw redirect({
      href: `/booking/${encodeURIComponent(params.uid)}${location.searchStr}`,
      statusCode: 301,
    });
  },
});

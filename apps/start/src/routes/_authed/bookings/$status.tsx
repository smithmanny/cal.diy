import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/components/AppShell";
import { FormError } from "~/components/AuthCard";
import { LOCATION_LABEL_KEYS } from "~/components/booker/locationLabels";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { formatLongDate, formatTime } from "~/lib/date-utils";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { cancelBookingAsHost, decideBooking, listHostBookings } from "~/server/bookings/functions";

const STATUSES = ["upcoming", "unconfirmed", "past", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

const EMPTY_KEYS: Record<Status, string> = {
  upcoming: "upcoming_bookings",
  unconfirmed: "unconfirmed_bookings",
  past: "past_bookings",
  cancelled: "cancelled_bookings",
};

const PAGE_SIZE = 50;

const MESSAGE_KEYS = [
  ...STATUSES,
  ...Object.values(EMPTY_KEYS),
  ...Object.values(LOCATION_LABEL_KEYS),
  "bookings",
  "accept",
  "reject",
  "rejection_reason",
  "rejection_reason_title",
  "cancel_event",
  "cancellation_reason",
  "reschedule",
  "view_booking",
  "load_more_results",
  "unconfirmed",
  "rejected",
  "something_went_wrong",
  "booking_not_found",
  "event_cancelled",
];

function BookingsPage() {
  const { bookings } = Route.useLoaderData();
  const { status } = Route.useParams();
  const limit = Route.useSearch().limit ?? PAGE_SIZE;
  const { locale, user } = Route.useRouteContext();
  const t = useT();
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setErrorKey(null);
    try {
      await action();
      await router.invalidate();
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }

  const cancel = (uid: string) => {
    const reason = window.prompt(t("cancellation_reason"));
    if (reason !== null) run(() => cancelBookingAsHost({ data: { uid, reason: reason || undefined } }));
  };
  const reject = (uid: string) => {
    const reason = window.prompt(`${t("rejection_reason_title")}\n${t("rejection_reason")}`);
    if (reason !== null)
      run(() => decideBooking({ data: { uid, accept: false, reason: reason || undefined } }));
  };

  return (
    <HydratedFieldset>
      <PageHeader title={t("bookings")} />
      <nav className="mb-4 flex gap-1 overflow-x-auto border-b">
        {STATUSES.map((tab) => (
          <Link
            key={tab}
            to="/bookings/$status"
            params={{ status: tab }}
            className="-mb-px whitespace-nowrap border-b-2 px-3 py-2 font-medium text-sm"
            activeProps={{ className: "border-foreground text-foreground" }}
            inactiveProps={{ className: "border-transparent text-muted-foreground" }}>
            {t(tab)}
          </Link>
        ))}
      </nav>
      <FormError message={errorKey && t(errorKey)} />
      {bookings.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          {t(EMPTY_KEYS[status])}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {bookings.map((booking) => (
            <li key={booking.uid} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <div className="w-48 shrink-0 text-sm">
                <div className="font-medium">{formatLongDate(booking.startTime, user.timeZone, locale)}</div>
                <div className="text-muted-foreground">
                  {formatTime(booking.startTime, user.timeZone, locale, user.hour12)} -{" "}
                  {formatTime(booking.endTime, user.timeZone, locale, user.hour12)}
                </div>
                {booking.status === "PENDING" && <Badge variant="warning">{t("unconfirmed")}</Badge>}
                {booking.status === "REJECTED" && <Badge variant="error">{t("rejected")}</Badge>}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                  to="/booking/$uid"
                  params={{ uid: booking.uid }}
                  className="font-medium hover:underline">
                  {booking.title}
                </Link>
                <span className="text-muted-foreground text-sm">
                  {booking.attendees.map((attendee) => `${attendee.name} <${attendee.email}>`).join(", ")}
                </span>
                {booking.location && (
                  <span className="truncate text-muted-foreground text-xs">
                    {LOCATION_LABEL_KEYS[booking.location]
                      ? t(LOCATION_LABEL_KEYS[booking.location])
                      : booking.location}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {status === "unconfirmed" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => run(() => decideBooking({ data: { uid: booking.uid, accept: true } }))}>
                      {t("accept")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reject(booking.uid)}>
                      {t("reject")}
                    </Button>
                  </>
                )}
                {status === "upcoming" && (
                  <Button size="sm" variant="outline" onClick={() => cancel(booking.uid)}>
                    {t("cancel_event")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {bookings.length >= limit && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            render={
              <Link to="/bookings/$status" params={{ status }} search={{ limit: limit + PAGE_SIZE }} />
            }>
            {t("load_more_results")}
          </Button>
        </div>
      )}
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/bookings/$status")({
  params: {
    parse: ({ status }) => {
      if (!STATUSES.includes(status as Status)) throw notFound();
      return { status: status as Status };
    },
    stringify: ({ status }) => ({ status }),
  },
  validateSearch: (search: Record<string, unknown>): { limit?: number } => {
    const limit = Number(search.limit);
    return { limit: Number.isInteger(limit) && limit > 0 && limit <= 500 ? limit : undefined };
  },
  loaderDeps: ({ search }) => ({ limit: search.limit ?? PAGE_SIZE }),
  loader: async ({ context, params, deps }) => {
    const [messages, bookings] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      listHostBookings({ data: { filter: params.status, limit: deps.limit } }),
    ]);
    return { messages, bookings };
  },
  component: BookingsPage,
});

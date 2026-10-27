import { Button } from "@coss/ui/components/button";
import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/components/AppShell";
import { FormError } from "~/components/AuthCard";
import { BOOKING_EDIT_MESSAGE_KEYS, BookingEditMenu } from "~/components/bookings/BookingEditMenu";
import {
  BOOKING_FILTER_MESSAGE_KEYS,
  BookingFilters,
  type BookingSearch,
  hasBookingSearch,
  parseBookingSearch,
} from "~/components/bookings/BookingFilters";
import { BOOKING_HISTORY_MESSAGE_KEYS } from "~/components/bookings/BookingHistoryDialog";
import {
  BOOKING_LIST_ITEM_MESSAGE_KEYS,
  BookingListItem,
  type ListedBooking,
} from "~/components/bookings/BookingListItem";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { dayRangeInTimeZone } from "~/lib/date-utils";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { LOCATION_LABEL_KEYS } from "~/lib/location-labels";
import { loadMessages } from "~/lib/messages";
import { RECURRING_MESSAGE_KEYS } from "~/lib/recurring";
import {
  cancelBookingAsHost,
  decideBooking,
  listHostBookings,
  markNoShow,
} from "~/server/bookings/functions";
import { listEventTypes } from "~/server/event-types/functions";

const STATUSES = ["upcoming", "unconfirmed", "recurring", "past", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

const EMPTY_KEYS: Record<Status, string> = {
  upcoming: "upcoming_bookings",
  unconfirmed: "unconfirmed_bookings",
  recurring: "recurring_bookings",
  past: "past_bookings",
  cancelled: "cancelled_bookings",
};

const PAGE_SIZE = 50;

const MESSAGE_KEYS = [
  ...STATUSES,
  ...RECURRING_MESSAGE_KEYS,
  ...Object.values(EMPTY_KEYS),
  ...Object.values(LOCATION_LABEL_KEYS),
  ...BOOKING_FILTER_MESSAGE_KEYS,
  ...BOOKING_LIST_ITEM_MESSAGE_KEYS,
  ...BOOKING_EDIT_MESSAGE_KEYS,
  ...BOOKING_HISTORY_MESSAGE_KEYS,
  "guests_disabled",
  "booking_has_ended",
  "emails_must_be_unique_valid",
  "no_results",
  "no_show_before_start",
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
  "something_went_wrong",
  "booking_not_found",
  "event_cancelled",
];

/** Runs a booking action, then reloads the list; failures show above it. */
function useBookingAction() {
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setErrorKey(null);
    try {
      await action();
      await router.invalidate();
      return true;
    } catch (error) {
      setErrorKey(errorMessageKey(error));
      return false;
    }
  }
  return { run, errorKey };
}

function HostActions({
  booking,
  status,
  run,
}: {
  booking: ListedBooking;
  status: Status;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
}) {
  const t = useT();
  if (!booking.isOrganizer) return null;
  const cancel = () => {
    const reason = window.prompt(t("cancellation_reason"));
    if (reason !== null)
      run(() =>
        cancelBookingAsHost({
          // In the recurring tab a row stands for the series, so cancelling cancels what remains of it.
          data: { uid: booking.uid, reason: reason || undefined, allRemaining: status === "recurring" },
        })
      );
  };
  const reject = () => {
    const reason = window.prompt(`${t("rejection_reason_title")}\n${t("rejection_reason")}`);
    if (reason !== null)
      run(() => decideBooking({ data: { uid: booking.uid, accept: false, reason: reason || undefined } }));
  };
  if (status === "unconfirmed")
    return (
      <>
        <Button
          size="sm"
          onClick={() => run(() => decideBooking({ data: { uid: booking.uid, accept: true } }))}>
          {t("accept")}
        </Button>
        <Button size="sm" variant="outline" onClick={reject}>
          {t("reject")}
        </Button>
      </>
    );
  if (status !== "upcoming" && status !== "recurring") return null;
  return (
    <>
      <BookingEditMenu uid={booking.uid} run={run} />
      <Button size="sm" variant="outline" onClick={cancel}>
        {t("cancel_event")}
      </Button>
    </>
  );
}

function StatusTabs({ search }: { search: BookingSearch }) {
  const t = useT();
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b">
      {STATUSES.map((tab) => (
        <Link
          key={tab}
          to="/bookings/$status"
          params={{ status: tab }}
          search={search}
          className="-mb-px whitespace-nowrap border-b-2 px-3 py-2 font-medium text-sm"
          activeProps={{ className: "border-foreground text-foreground" }}
          inactiveProps={{ className: "border-transparent text-muted-foreground" }}>
          {t(tab)}
        </Link>
      ))}
    </nav>
  );
}

function BookingsPage() {
  const { bookings, eventTypes, now } = Route.useLoaderData();
  const { status } = Route.useParams();
  const { limit = PAGE_SIZE, ...search } = Route.useSearch();
  const { locale, user } = Route.useRouteContext();
  const t = useT();
  const navigate = useNavigate({ from: Route.fullPath });
  const { run, errorKey } = useBookingAction();
  const viewer = { timeZone: user.timeZone, locale, hour12: user.hour12 };
  // Attendees can be marked absent once the meeting has started, as in Cal.
  const noShowHandler = (booking: ListedBooking) =>
    booking.isOrganizer && new Date(booking.startTime).getTime() <= now && booking.status === "ACCEPTED"
      ? (email: string, noShow: boolean) =>
          run(() => markNoShow({ data: { uid: booking.uid, attendees: [{ email, noShow }] } }))
      : undefined;

  return (
    <HydratedFieldset>
      <PageHeader title={t("bookings")} />
      <StatusTabs search={search} />
      <BookingFilters
        search={search}
        eventTypes={eventTypes}
        onChange={(next) => navigate({ search: next, replace: true })}
      />
      <FormError message={errorKey && t(errorKey)} />
      {bookings.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          {t(hasBookingSearch(search) ? "no_results" : EMPTY_KEYS[status])}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {bookings.map((booking) => (
            <BookingListItem
              key={booking.uid}
              booking={booking}
              viewer={viewer}
              showRecurring={status === "recurring"}
              onNoShow={noShowHandler(booking)}
              actions={<HostActions booking={booking} status={status} run={run} />}
            />
          ))}
        </ul>
      )}
      {bookings.length >= limit && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            render={
              <Link
                to="/bookings/$status"
                params={{ status }}
                search={{ ...search, limit: limit + PAGE_SIZE }}
              />
            }>
            {t("load_more_results")}
          </Button>
        </div>
      )}
    </HydratedFieldset>
  );
}

/** Whole days in the host's time zone, as the server's instants. */
function searchRange(search: BookingSearch, timeZone: string) {
  return {
    from: search.from ? dayRangeInTimeZone(search.from, 1, timeZone).from.toISOString() : undefined,
    to: search.to ? dayRangeInTimeZone(search.to, 1, timeZone).to.toISOString() : undefined,
  };
}

export const Route = createFileRoute("/_authed/bookings/$status")({
  params: {
    parse: ({ status }) => {
      if (!STATUSES.includes(status as Status)) throw notFound();
      return { status: status as Status };
    },
    stringify: ({ status }) => ({ status }),
  },
  validateSearch: (search: Record<string, unknown>): BookingSearch & { limit?: number } => {
    const limit = Number(search.limit);
    return {
      ...parseBookingSearch(search),
      limit: Number.isInteger(limit) && limit > 0 && limit <= 500 ? limit : undefined,
    };
  },
  loaderDeps: ({ search }) => ({ ...search, limit: search.limit ?? PAGE_SIZE }),
  loader: async ({ context, params, deps }) => {
    const { limit, eventTypeId, attendee } = deps;
    const [messages, bookings, eventTypes] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      listHostBookings({
        data: {
          filter: params.status,
          limit,
          eventTypeIds: eventTypeId ? [eventTypeId] : undefined,
          attendee,
          ...searchRange(deps, context.user.timeZone),
        },
      }),
      listEventTypes(),
    ]);
    return {
      messages,
      bookings,
      eventTypes: eventTypes.map(({ id, title }) => ({ id, title })),
      now: Date.now(),
    };
  },
  component: BookingsPage,
});

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "~/components/AppShell";
import { BOOKING_HISTORY_MESSAGE_KEYS, HistoryList } from "~/components/bookings/BookingHistoryDialog";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { getBookingHistory } from "~/server/bookings/functions";

/** Cal's /booking/<uid>/logs: the organizer's full-page view of a booking's history. */
function BookingLogsPage() {
  const { entries } = Route.useLoaderData();
  const { uid } = Route.useParams();
  const { locale, user } = Route.useRouteContext();
  const t = useT();
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Link
        to="/booking/$uid"
        params={{ uid }}
        className="flex items-center gap-1 text-muted-foreground text-sm">
        <ArrowLeftIcon className="size-4" />
        {t("back")}
      </Link>
      <PageHeader title={t("booking_history")} />
      <HistoryList entries={entries} viewer={{ timeZone: user.timeZone, locale, hour12: user.hour12 }} />
    </div>
  );
}

export const Route = createFileRoute("/_authed/booking/$uid/logs")({
  loader: async ({ context, params }) => {
    const [messages, entries] = await Promise.all([
      loadMessages(context, [...BOOKING_HISTORY_MESSAGE_KEYS, "back"]),
      getBookingHistory({ data: { uid: params.uid, locale: context.locale } }).catch(() => {
        throw notFound();
      }),
    ]);
    return { messages, entries };
  },
  component: BookingLogsPage,
});

import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { EventColorBar } from "~/components/EventColorBar";
import { formatLongDate, formatTime } from "~/lib/date-utils";
import { useT } from "~/lib/i18n";
import { LOCATION_LABEL_KEYS } from "~/lib/location-labels";
import { recurringSummary } from "~/lib/recurring";
import type { listHostBookings } from "~/server/bookings/functions";

type ListedBooking = Awaited<ReturnType<typeof listHostBookings>>[number];

type Viewer = { timeZone: string; locale: string; hour12?: boolean };

function When({
  booking,
  viewer,
  showRecurring,
}: {
  booking: ListedBooking;
  viewer: Viewer;
  showRecurring: boolean;
}) {
  const t = useT();
  const { timeZone, locale, hour12 } = viewer;
  return (
    <div className="w-48 shrink-0 text-sm">
      <div className="font-medium">{formatLongDate(booking.startTime, timeZone, locale)}</div>
      <div className="text-muted-foreground">
        {formatTime(booking.startTime, timeZone, locale, hour12)} -{" "}
        {formatTime(booking.endTime, timeZone, locale, hour12)}
      </div>
      {showRecurring && booking.recurring && (
        <div className="text-muted-foreground text-xs">{recurringSummary(booking.recurring, t)}</div>
      )}
      {booking.status === "PENDING" && <Badge variant="warning">{t("unconfirmed")}</Badge>}
      {booking.status === "REJECTED" && <Badge variant="error">{t("rejected")}</Badge>}
    </div>
  );
}

function Attendees({
  booking,
  onNoShow,
}: {
  booking: ListedBooking;
  /** Set once the booking has started and the viewer organizes it. */
  onNoShow?: (email: string, noShow: boolean) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1 text-muted-foreground text-sm">
      {booking.attendees.map((attendee) => (
        <div key={attendee.email} className="flex flex-wrap items-center gap-2">
          <span className={attendee.noShow ? "line-through" : undefined}>
            {attendee.name ? `${attendee.name} <${attendee.email}>` : attendee.email}
          </span>
          {attendee.noShow && <Badge variant="error">{t("no_show")}</Badge>}
          {onNoShow && (
            <Button
              size="xs"
              variant="ghost"
              aria-label={`${t(attendee.noShow ? "unmark_as_no_show" : "mark_as_no_show")}: ${attendee.email}`}
              onClick={() => onNoShow(attendee.email, !attendee.noShow)}>
              {t(attendee.noShow ? "unmark_as_no_show" : "mark_as_no_show")}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export function BookingListItem({
  booking,
  viewer,
  showRecurring,
  onNoShow,
  actions,
}: {
  booking: ListedBooking;
  viewer: Viewer;
  showRecurring: boolean;
  onNoShow?: (email: string, noShow: boolean) => void;
  actions: ReactNode;
}) {
  const t = useT();
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <EventColorBar color={booking.eventTypeColor} />
      <When booking={booking} viewer={viewer} showRecurring={showRecurring} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link to="/booking/$uid" params={{ uid: booking.uid }} className="font-medium hover:underline">
          {booking.title}
        </Link>
        <Attendees booking={booking} onNoShow={onNoShow} />
        {booking.location && (
          <span className="truncate text-muted-foreground text-xs">
            {LOCATION_LABEL_KEYS[booking.location]
              ? t(LOCATION_LABEL_KEYS[booking.location])
              : booking.location}
          </span>
        )}
      </div>
      <div className="flex shrink-0 gap-2">{actions}</div>
    </li>
  );
}

export const BOOKING_LIST_ITEM_MESSAGE_KEYS = [
  "unconfirmed",
  "rejected",
  "no_show",
  "mark_as_no_show",
  "unmark_as_no_show",
];

export type { ListedBooking };

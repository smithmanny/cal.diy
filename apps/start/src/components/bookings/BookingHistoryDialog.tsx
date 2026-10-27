import { Button } from "@coss/ui/components/button";
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@coss/ui/components/dialog";
import { useEffect, useState } from "react";
import { formatLongDate, formatTime } from "~/lib/date-utils";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import type { HistoryEntryDto } from "~/server/bookings/BookingActionsService";
import { getBookingHistory } from "~/server/bookings/functions";

type Viewer = { timeZone: string; locale: string; hour12?: boolean };

// Cal's history titles mark the new date with <0>…</0> for bold; plain text here.
const stripTags = (text: string) => text.replace(/<\/?\d+>/g, "");

function HistoryList({ entries, viewer }: { entries: HistoryEntryDto[]; viewer: Viewer }) {
  const t = useT();
  if (!entries.length) return <p className="text-muted-foreground text-sm">{t("no_results")}</p>;
  return (
    <ol className="flex flex-col gap-4">
      {entries.map((entry) => (
        <li key={entry.id} className="border-l-2 pl-3 text-sm">
          <div className="font-medium">{stripTags(t(entry.title.key, entry.title.values))}</div>
          <div className="text-muted-foreground text-xs">
            {formatLongDate(entry.timestamp, viewer.timeZone, viewer.locale)}{" "}
            {formatTime(entry.timestamp, viewer.timeZone, viewer.locale, viewer.hour12)}
            {" · "}
            {entry.actor.name || entry.actor.email || t("booking_audit_action.unknown_user")}
          </div>
          {entry.details.map((detail) => (
            <div key={`${detail.label}:${detail.value}`} className="text-muted-foreground text-xs">
              {t(detail.label)}: {t(detail.value)}
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}

/** Cal's booking history for the organizer, loaded when opened. */
export function BookingHistoryButton({ uid, viewer }: { uid: string; viewer: Viewer }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryEntryDto[] | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setEntries(null);
    getBookingHistory({ data: { uid, locale: viewer.locale } })
      .then(setEntries)
      .catch((error: unknown) => setErrorKey(errorMessageKey(error)));
  }, [open, uid, viewer.locale]);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {t("history")}
      </Button>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>{t("booking_history")}</DialogTitle>
            </DialogHeader>
            <DialogPanel>
              {errorKey && <p className="text-destructive text-sm">{t(errorKey)}</p>}
              {entries && <HistoryList entries={entries} viewer={viewer} />}
            </DialogPanel>
          </DialogPopup>
        </Dialog>
      )}
    </>
  );
}

export const BOOKING_HISTORY_MESSAGE_KEYS = [
  "history",
  "booking_history",
  "no_results",
  "yes",
  "no",
  "cancellation_reason",
  "rejection_reason",
  "reason_for_reschedule_request",
  ...[
    "created",
    "created_awaiting_host",
    "created_with_seat",
    "cancelled",
    "rescheduled",
    "accepted",
    "reschedule_requested",
    "attendee_added",
    "host_no_show_updated",
    "attendee_no_show_updated",
    "no_show_updated",
    "rejected",
    "attendee_removed",
    "reassignment",
    "location_changed",
    "location_changed_from_to",
    "seat_booked",
    "seat_rescheduled",
    "error_processing",
    "attendees",
    "unknown_user",
  ].map((key) => `booking_audit_action.${key}`),
];

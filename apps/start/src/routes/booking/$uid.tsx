import { Button } from "@coss/ui/components/button";
import { Textarea } from "@coss/ui/components/textarea";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { CheckCircle2Icon, ClockIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { FormError } from "~/components/AuthCard";
import { LOCATION_LABEL_KEYS } from "~/components/booker/locationLabels";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { formatLongDate, formatTime } from "~/lib/date-utils";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { cancelBookingByUid, getBookingByUid } from "~/server/bookings/functions";

const MESSAGE_KEYS = [
  ...Object.values(LOCATION_LABEL_KEYS),
  "meeting_is_scheduled",
  "emailed_you_and_any_other_attendees",
  "booking_submitted",
  "user_needs_to_confirm_or_reject_booking",
  "event_cancelled",
  "booking_rescheduled",
  "what",
  "when",
  "who",
  "where",
  "host",
  "additional_notes",
  "cancellation_reason",
  "cancellation_reason_placeholder",
  "need_to_reschedule_or_cancel",
  "reschedule",
  "cancel",
  "cancel_event",
  "back",
  "something_went_wrong",
];

function statusPresentation(status: string, rescheduled: boolean) {
  if (status === "CANCELLED" || status === "REJECTED") {
    return { headingKey: rescheduled ? "booking_rescheduled" : "event_cancelled", Icon: XCircleIcon };
  }
  if (status === "PENDING") return { headingKey: "booking_submitted", Icon: ClockIcon };
  return { headingKey: "meeting_is_scheduled", Icon: CheckCircle2Icon };
}

function locationText(location: string | null, t: (key: string) => string): string | null {
  if (!location) return null;
  const labelKey = LOCATION_LABEL_KEYS[location];
  return labelKey ? t(labelKey) : location;
}

function isUrl(value: string) {
  return /^https?:\/\//.test(value);
}

function BookingPage() {
  const { booking } = Route.useLoaderData();
  const { locale } = Route.useRouteContext();
  const t = useT();
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Show times in the attendee's zone so server and client render the same thing.
  const timeZone = booking.attendees[0]?.timeZone ?? "UTC";
  const isCancelled = booking.status === "CANCELLED" || booking.status === "REJECTED";
  const isPending = booking.status === "PENDING";
  const isPast = new Date(booking.endTime) < new Date();

  async function cancel() {
    setPending(true);
    setErrorKey(null);
    try {
      await cancelBookingByUid({ data: { uid: booking.uid, reason: reason || undefined } });
      setCancelling(false);
      await router.invalidate();
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    } finally {
      setPending(false);
    }
  }

  const { headingKey, Icon } = statusPresentation(booking.status, booking.rescheduled);
  const heading = t(headingKey);

  const rows: [string, string | null][] = [
    [t("what"), booking.eventType?.title ?? booking.title],
    [
      t("when"),
      `${formatLongDate(booking.startTime, timeZone, locale)}\n${formatTime(booking.startTime, timeZone, locale)} - ${formatTime(booking.endTime, timeZone, locale)} (${timeZone})`,
    ],
    [
      t("who"),
      [
        booking.host ? `${booking.host.name ?? booking.host.email} (${t("host")})` : null,
        ...booking.attendees.map((attendee) => `${attendee.name} <${attendee.email}>`),
      ]
        .filter(Boolean)
        .join("\n"),
    ],
    [t("where"), locationText(booking.location, t)],
    [t("additional_notes"), booking.notes],
  ];

  return (
    <main className="flex min-h-screen items-start justify-center bg-muted/40 px-4 py-12">
      <HydratedFieldset className="flex w-full max-w-xl flex-col gap-6 rounded-xl border bg-background p-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <Icon className={`size-10 ${isCancelled ? "text-destructive" : "text-success"}`} />
          <h1 className="font-heading text-xl">{heading}</h1>
          {isPending && booking.host && (
            <p className="text-muted-foreground text-sm">
              {t("user_needs_to_confirm_or_reject_booking", {
                user: booking.host.name ?? booking.host.email,
              })}
            </p>
          )}
          {!isCancelled && !isPending && (
            <p className="text-muted-foreground text-sm">{t("emailed_you_and_any_other_attendees")}</p>
          )}
        </header>
        <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 border-t pt-6 text-sm">
          {rows.map(([label, value]) =>
            value ? (
              <div key={label} className="contents">
                <dt className="font-medium">{label}</dt>
                <dd className="whitespace-pre-line break-words">
                  {isUrl(value) ? (
                    <a href={value} className="underline" target="_blank" rel="noreferrer">
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ) : null
          )}
          {isCancelled && booking.cancellationReason && (
            <>
              <dt className="font-medium">{t("cancellation_reason")}</dt>
              <dd>{booking.cancellationReason}</dd>
            </>
          )}
        </dl>
        {!isCancelled && !isPast && booking.host?.username && booking.eventType && (
          <footer className="flex flex-col gap-3 border-t pt-6 text-center text-sm">
            {cancelling ? (
              <div className="flex flex-col gap-3 text-left">
                <label className="flex flex-col gap-1.5 font-medium">
                  {t("cancellation_reason")}
                  <Textarea
                    rows={3}
                    maxLength={1000}
                    placeholder={t("cancellation_reason_placeholder")}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <FormError message={errorKey && t(errorKey)} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setCancelling(false)}>
                    {t("back")}
                  </Button>
                  <Button variant="destructive" disabled={pending} onClick={cancel}>
                    {t("cancel_event")}
                  </Button>
                </div>
              </div>
            ) : (
              <p>
                {t("need_to_reschedule_or_cancel")}{" "}
                <Link
                  to="/$username/$slug"
                  params={{ username: booking.host.username, slug: booking.eventType.slug }}
                  search={{ rescheduleUid: booking.uid }}
                  className="font-medium underline">
                  {t("reschedule")}
                </Link>{" "}
                ·{" "}
                <button type="button" className="font-medium underline" onClick={() => setCancelling(true)}>
                  {t("cancel")}
                </button>
              </p>
            )}
          </footer>
        )}
      </HydratedFieldset>
    </main>
  );
}

export const Route = createFileRoute("/booking/$uid")({
  loader: async ({ context, params }) => {
    const [messages, booking] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getBookingByUid({ data: { uid: params.uid } }).catch(() => {
        throw notFound();
      }),
    ]);
    return { messages, booking };
  },
  component: BookingPage,
});

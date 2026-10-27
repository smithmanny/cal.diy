import { Button } from "@coss/ui/components/button";
import { Textarea } from "@coss/ui/components/textarea";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { CheckCircle2Icon, ClockIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { PoweredBy } from "~/components/PoweredBy";
import { ThemeScope } from "~/components/ThemeScope";
import { formatResponse } from "~/lib/booking-fields";
import { formatLongDate, formatTime } from "~/lib/date-utils";
import { errorMessageKey } from "~/lib/errors";
import { type TFunction, useT } from "~/lib/i18n";
import { LOCATION_LABEL_KEYS } from "~/lib/location-labels";
import { loadMessages } from "~/lib/messages";
import { RECURRING_MESSAGE_KEYS, recurringSummary } from "~/lib/recurring";
import { cancelBookingByUid, getBookingByUid } from "~/server/bookings/functions";

const MESSAGE_KEYS = [
  ...RECURRING_MESSAGE_KEYS,
  "booking_submitted_recurring",
  "meeting_is_scheduled_recurring",
  "emailed_host_and_attendee_recurring",
  "cancelling_all_recurring",
  "powered_by",
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
  "yes",
  "no",
  "cancellation_reason",
  "cancellation_reason_placeholder",
  "need_to_reschedule_or_cancel",
  "reschedule",
  "cancel",
  "cancel_event",
  "back",
  "something_went_wrong",
];

function statusPresentation(status: string, rescheduled: boolean, recurring: boolean) {
  if (status === "CANCELLED" || status === "REJECTED") {
    return { headingKey: rescheduled ? "booking_rescheduled" : "event_cancelled", Icon: XCircleIcon };
  }
  if (status === "PENDING")
    return { headingKey: recurring ? "booking_submitted_recurring" : "booking_submitted", Icon: ClockIcon };
  return {
    headingKey: recurring ? "meeting_is_scheduled_recurring" : "meeting_is_scheduled",
    Icon: CheckCircle2Icon,
  };
}

function locationText(location: string | null, t: (key: string) => string): string | null {
  if (!location) return null;
  const labelKey = LOCATION_LABEL_KEYS[location];
  return labelKey ? t(labelKey) : location;
}

function isUrl(value: string) {
  return /^https?:\/\//.test(value);
}

/** Reschedule and cancel links for the booker, with the cancellation form. */
function ManageFooter({
  booking,
  username,
  slug,
  t,
}: {
  booking: {
    uid: string;
    canCancel: boolean;
    canReschedule: boolean;
    recurring: object | null;
    seatReferenceUid: string | null;
  };
  username: string;
  slug: string;
  t: TFunction;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function cancel() {
    setPending(true);
    setErrorKey(null);
    try {
      await cancelBookingByUid({
        data: {
          uid: booking.uid,
          reason: reason || undefined,
          seatReferenceUid: booking.seatReferenceUid ?? undefined,
        },
      });
      setCancelling(false);
      await router.invalidate();
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <footer className="flex flex-col gap-3 border-t pt-6 text-center text-sm">
      {cancelling ? (
        <div className="flex flex-col gap-3 text-left">
          {booking.recurring && <p className="text-muted-foreground">{t("cancelling_all_recurring")}</p>}
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
          {booking.canReschedule && (
            <Link
              to="/$username/$slug"
              params={{ username: username, slug: slug }}
              search={{ rescheduleUid: booking.uid }}
              className="font-medium underline">
              {t("reschedule")}
            </Link>
          )}
          {booking.canReschedule && booking.canCancel && " · "}
          {booking.canCancel && (
            <button type="button" className="font-medium underline" onClick={() => setCancelling(true)}>
              {t("cancel")}
            </button>
          )}
        </p>
      )}
    </footer>
  );
}

function BookingPage() {
  const { booking } = Route.useLoaderData();
  const { locale } = Route.useRouteContext();
  const t = useT();
  // Show times in the attendee's zone so server and client render the same thing.
  const timeZone = booking.attendees[0]?.timeZone ?? "UTC";
  const isCancelled = booking.status === "CANCELLED" || booking.status === "REJECTED";
  const isPending = booking.status === "PENDING";
  const isPast = new Date(booking.endTime) < new Date();

  const { headingKey, Icon } = statusPresentation(
    booking.status,
    booking.rescheduled,
    Boolean(booking.recurring)
  );
  const heading = t(headingKey);

  const hostName = booking.host?.name ?? booking.host?.email ?? booking.host?.username ?? "";
  const timeRange = (range: { startTime: string; endTime: string }) =>
    `${formatLongDate(range.startTime, timeZone, locale)}\n${formatTime(range.startTime, timeZone, locale)} - ${formatTime(range.endTime, timeZone, locale)}`;
  const rows: [string, string | null][] = [
    [t("what"), booking.title],
    [
      t("when"),
      booking.recurring
        ? [
            recurringSummary(booking.recurring, t),
            ...booking.recurring.occurrences
              .filter((occurrence) => isCancelled || occurrence.status !== "CANCELLED")
              .map((occurrence) => timeRange(occurrence)),
            `(${timeZone})`,
          ].join("\n")
        : `${timeRange(booking)} (${timeZone})`,
    ],
    [
      t("who"),
      [
        booking.host ? `${hostName} (${t("host")})` : null,
        ...booking.attendees.map((attendee) =>
          attendee.name ? `${attendee.name} <${attendee.email}>` : attendee.email
        ),
      ]
        .filter(Boolean)
        .join("\n"),
    ],
    [t("where"), locationText(booking.location, t)],
    [t("additional_notes"), booking.notes],
    ...booking.answers.map((answer): [string, string] => [
      answer.label || t(answer.defaultLabel ?? answer.name),
      formatResponse(answer.value, t),
    ]),
  ];

  return (
    <ThemeScope
      theme={booking.host?.appearance.theme ?? null}
      brandColor={booking.host?.appearance.brandColor}
      darkBrandColor={booking.host?.appearance.darkBrandColor}>
      <main className="flex min-h-screen flex-col items-center bg-muted/40 px-4 py-12">
        <HydratedFieldset className="flex w-full max-w-xl flex-col gap-6 rounded-xl border bg-background p-6">
          <header className="flex flex-col items-center gap-2 text-center">
            <Icon className={`size-10 ${isCancelled ? "text-destructive" : "text-success"}`} />
            <h1 className="font-heading text-xl">{heading}</h1>
            {isPending && booking.host && (
              <p className="text-muted-foreground text-sm">
                {t("user_needs_to_confirm_or_reject_booking", {
                  user: hostName,
                })}
              </p>
            )}
            {!isCancelled && !isPending && booking.emailsEnabled && (
              <p className="text-muted-foreground text-sm">
                {t(
                  booking.recurring
                    ? "emailed_host_and_attendee_recurring"
                    : "emailed_you_and_any_other_attendees"
                )}
              </p>
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
          {!isCancelled &&
            !isPast &&
            (booking.canCancel || booking.canReschedule) &&
            booking.host?.username &&
            booking.eventType && (
              <ManageFooter
                booking={booking}
                username={booking.host.username}
                slug={booking.eventType.slug}
                t={t}
              />
            )}
        </HydratedFieldset>
        <PoweredBy hidden={booking.host?.appearance.hideBranding ?? false} t={t} />
      </main>
    </ThemeScope>
  );
}

export const Route = createFileRoute("/booking/$uid")({
  validateSearch: (search: Record<string, unknown>): { seatReferenceUid?: string } => ({
    seatReferenceUid: typeof search.seatReferenceUid === "string" ? search.seatReferenceUid : undefined,
  }),
  loaderDeps: ({ search }) => ({ seatReferenceUid: search.seatReferenceUid }),
  loader: async ({ context, params, deps }) => {
    const [messages, booking] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getBookingByUid({ data: { uid: params.uid, seatReferenceUid: deps.seatReferenceUid } }).catch(() => {
        throw notFound();
      }),
    ]);
    return { messages, booking };
  },
  component: BookingPage,
});

import { recurringDates } from "@calcom/scheduling/recurring";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookerSidebar } from "~/components/booker/BookerSidebar";
import { BOOKING_FIELD_MESSAGE_KEYS } from "~/components/booker/BookingFieldInput";
import { BookingForm, type BookingSubmission } from "~/components/booker/BookingForm";
import { SlotPicker } from "~/components/booker/SlotPicker";
import { useMonthSlots } from "~/components/booker/useMonthSlots";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { PoweredBy } from "~/components/PoweredBy";
import { ThemeScope } from "~/components/ThemeScope";
import { HourCycleProvider } from "~/lib/hour-cycle";
import { useT } from "~/lib/i18n";
import { LOCATION_LABEL_KEYS } from "~/lib/location-labels";
import { loadMessages } from "~/lib/messages";
import { RECURRING_MESSAGE_KEYS } from "~/lib/recurring";
import { NOINDEX_META } from "~/lib/seo";
import { createBooking, getPublicEvent, sendBookerVerificationCode } from "~/server/bookings/functions";

const MESSAGE_KEYS = [
  ...BOOKING_FIELD_MESSAGE_KEYS,
  ...RECURRING_MESSAGE_KEYS,
  "duration",
  "multiple_duration_mins",
  "invalid_event_length",
  "verification_code_sent",
  "verification_code",
  "email_verification_code_placeholder",
  "email_verification_required",
  "invalid_verification_code",
  "too_many_attempts",
  "resend",
  "powered_by",
  ...Object.values(LOCATION_LABEL_KEYS),
  "minutes",
  "timezone",
  "no_available_slots",
  "view_previous_month",
  "view_next_month",
  "confirm",
  "back",
  "loading",
  "reschedule_booking",
  "requires_confirmation",
  "booking_conflict_error",
  "enter_phone_number",
  "invalid_timezone",
  "booking_not_found",
  "event_cancelled",
  "something_went_wrong",
  "time_format",
  "12_hour_short",
  "24_hour_short",
  "ooo_user_is_ooo",
  "ooo_slots_book_with",
  "holiday_no_availability",
  "booker_upcoming_limit_reached",
  "booker_limit_exceeded_error_reschedule",
  "reschedule",
  "ooo_reasons_unspecified",
  "ooo_reasons_vacation",
  "ooo_reasons_travel",
  "ooo_reasons_sick_leave",
  "ooo_reasons_public_holiday",
];

// Same key as Cal's booker, so a returning visitor's choice carries over.
const HOUR_CYCLE_STORAGE_KEY = "timeOption.is24hClock";

function useStoredHour12(): [boolean | undefined, (hour12: boolean) => void] {
  const [hour12, setHour12] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HOUR_CYCLE_STORAGE_KEY);
      if (stored !== null) setHour12(stored !== "true");
    } catch {
      // Storage can be unavailable (private mode); the locale's convention applies.
    }
  }, []);
  function update(next: boolean) {
    setHour12(next);
    try {
      localStorage.setItem(HOUR_CYCLE_STORAGE_KEY, String(!next));
    } catch {
      // Not remembered, but still applied for this visit.
    }
  }
  return [hour12, update];
}

function BookerPage() {
  const { event, locale, rescheduleUid } = Route.useLoaderData();
  const { username, slug } = Route.useParams();
  const t = useT();
  const navigate = useNavigate();
  const [duration, setDuration] = useState(event.eventType.length);
  const [recurringCount, setRecurringCount] = useState(event.eventType.recurringEvent?.count ?? 1);
  const hasDurationChoice = event.eventType.durations.length > 1;
  const slots = useMonthSlots({
    username,
    slug,
    rescheduleUid,
    lockedTimeZone: event.eventType.lockedTimeZone,
    duration: hasDurationChoice ? duration : undefined,
  });
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [hour12, setHour12] = useStoredHour12();

  async function book(submission: BookingSubmission) {
    if (!selectedSlot || !slots.timeZone) return;
    const { uid, redirectUrl } = await createBooking({
      data: {
        username,
        slug,
        start: selectedSlot,
        timeZone: slots.timeZone,
        locale,
        responses: submission.responses,
        duration: hasDurationChoice ? duration : undefined,
        verificationCode: submission.verificationCode,
        recurringCount: event.eventType.recurringEvent && !rescheduleUid ? recurringCount : undefined,
        rescheduleUid: submission.rescheduleUid ?? rescheduleUid,
      },
    });
    // The host's own thank-you page replaces ours, as in Cal.
    if (redirectUrl) window.location.assign(redirectUrl);
    else await navigate({ to: "/booking/$uid", params: { uid } });
  }

  return (
    <HourCycleProvider hour12={hour12}>
      <ThemeScope
        theme={event.host.appearance.theme}
        brandColor={event.host.appearance.brandColor}
        darkBrandColor={event.host.appearance.darkBrandColor}>
        <main
          lang={locale}
          className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-8">
          <HydratedFieldset className="grid w-full max-w-5xl overflow-hidden rounded-xl border bg-background md:grid-cols-[18rem_1fr]">
            <BookerSidebar
              event={event}
              rescheduling={Boolean(rescheduleUid)}
              timeZone={slots.timeZone}
              onTimeZoneChange={slots.setTimeZone}
              recurringCount={recurringCount}
              onRecurringCountChange={setRecurringCount}
              duration={duration}
              onDurationChange={(minutes) => {
                setDuration(minutes);
                setSelectedSlot(null);
              }}
              t={t}
            />
            <section className="p-6">
              {selectedSlot && slots.timeZone ? (
                <BookingForm
                  slot={selectedSlot}
                  timeZone={slots.timeZone}
                  locale={locale}
                  locations={event.eventType.locations}
                  fields={event.eventType.bookingFields}
                  occurrences={
                    event.eventType.recurringEvent && !rescheduleUid
                      ? recurringDates(new Date(selectedSlot), slots.timeZone, {
                          ...event.eventType.recurringEvent,
                          count: recurringCount,
                        }).map((date) => date.toISOString())
                      : undefined
                  }
                  view={rescheduleUid ? "reschedule" : "booking"}
                  onSendCode={
                    event.eventType.requiresBookerEmailVerification && !rescheduleUid
                      ? (email) => sendBookerVerificationCode({ data: { username, slug, email, locale } })
                      : undefined
                  }
                  onBack={() => setSelectedSlot(null)}
                  onSubmit={book}
                  t={t}
                />
              ) : (
                <SlotPicker
                  cursor={slots.cursor}
                  timeZone={slots.timeZone}
                  locale={locale}
                  loading={slots.loading}
                  slotsByDate={slots.slotsByDate}
                  outOfOffice={slots.outOfOffice}
                  errorKey={slots.errorKey}
                  onMoveMonth={slots.moveMonth}
                  onSelectSlot={setSelectedSlot}
                  weekStartDay={event.host.weekStartDay}
                  onHour12Change={setHour12}
                  t={t}
                />
              )}
            </section>
          </HydratedFieldset>
          <PoweredBy hidden={event.host.appearance.hideBranding} t={t} />
        </main>
      </ThemeScope>
    </HourCycleProvider>
  );
}

export const Route = createFileRoute("/$username/$slug")({
  validateSearch: (search: Record<string, unknown>): { rescheduleUid?: string } => ({
    rescheduleUid: typeof search.rescheduleUid === "string" ? search.rescheduleUid : undefined,
  }),
  loaderDeps: ({ search }) => ({ rescheduleUid: search.rescheduleUid }),
  loader: async ({ context, params, deps }) => {
    const event = await getPublicEvent({ data: params }).catch(() => {
      throw notFound();
    });
    // A host can pin the booking page's language; otherwise it follows the visitor.
    const locale = event.eventType.interfaceLanguage ?? context.locale;
    const messages = await loadMessages({ locale }, MESSAGE_KEYS);
    return { messages, event, locale, rescheduleUid: deps.rescheduleUid };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.event.eventType.title} | ${loaderData.event.host.name ?? ""}`
          : "Cal.diy",
      },
      ...(loaderData && !loaderData.event.host.allowSEOIndexing ? [NOINDEX_META] : []),
    ],
  }),
  component: BookerPage,
});

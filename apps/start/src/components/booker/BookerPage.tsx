import { recurringDates } from "@calcom/scheduling/recurring";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useEmbed } from "~/components/embed/EmbedProvider";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { PoweredBy } from "~/components/PoweredBy";
import { ThemeScope } from "~/components/ThemeScope";
import { type BookerLayout, initialLayout, LAYOUT_LABEL_KEYS } from "~/lib/booker-layouts";
import { prefillFromSearch } from "~/lib/booking-fields";
import { bookingSuccessfulPayload } from "~/lib/embed";
import { HourCycleProvider } from "~/lib/hour-cycle";
import { type TFunction, useT } from "~/lib/i18n";
import { LOCATION_LABEL_KEYS } from "~/lib/location-labels";
import { RECURRING_MESSAGE_KEYS } from "~/lib/recurring";
import { createBooking, sendBookerVerificationCode } from "~/server/bookings/functions";
import type { PublicEventDto } from "~/server/bookings/types";
import { BookerSidebar } from "./BookerSidebar";
import { BOOKING_FIELD_MESSAGE_KEYS } from "./BookingFieldInput";
import { BookingForm, type BookingSubmission } from "./BookingForm";
import { DayColumns } from "./DayColumns";
import { SlotPicker } from "./SlotPicker";
import { useMonthSlots } from "./useMonthSlots";

const BOOKER_MESSAGE_KEYS = [
  ...Object.values(LAYOUT_LABEL_KEYS),
  "layout",
  "view_previous_week",
  "view_next_week",
  ...BOOKING_FIELD_MESSAGE_KEYS,
  ...RECURRING_MESSAGE_KEYS,
  "duration",
  "multiple_duration_mins",
  "invalid_event_length",
  "seats_available",
  "booking_seats_full_error",
  "already_signed_up_for_this_booking_error",
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

/** The times to pick from, in the month view or as day columns (week and column views). */
function TimesPanel({
  layout,
  slots,
  locale,
  weekStartDay,
  onSelectSlot,
  onHour12Change,
  t,
}: {
  layout: BookerLayout;
  slots: ReturnType<typeof useMonthSlots>;
  locale: string;
  weekStartDay: number;
  onSelectSlot: (slot: string) => void;
  onHour12Change: (hour12: boolean) => void;
  t: TFunction;
}) {
  const shared = {
    timeZone: slots.timeZone,
    locale,
    loading: slots.loading,
    slotsByDate: slots.slotsByDate,
    outOfOffice: slots.outOfOffice,
    errorKey: slots.errorKey,
    onSelectSlot,
    onHour12Change,
    seats: slots.seats,
    t,
  };
  if (layout === "month_view")
    return (
      <SlotPicker
        {...shared}
        cursor={slots.cursor}
        onMoveMonth={slots.moveMonth}
        weekStartDay={weekStartDay}
      />
    );
  return <DayColumns {...shared} days={slots.days} onMove={slots.moveDays} />;
}

/** Lets bookers switch between the views the host enabled. */
function LayoutSwitcher({
  enabled,
  value,
  onChange,
  t,
}: {
  enabled: BookerLayout[];
  value: BookerLayout;
  onChange: (layout: BookerLayout) => void;
  t: TFunction;
}) {
  if (enabled.length < 2) return null;
  return (
    <div role="radiogroup" aria-label={t("layout")} className="flex self-end rounded-md border p-0.5 text-xs">
      {enabled.map((layout) => (
        <button
          key={layout}
          type="button"
          role="radio"
          aria-checked={value === layout}
          onClick={() => onChange(layout)}
          className={`rounded px-2 py-1 ${value === layout ? "bg-accent font-medium" : "text-muted-foreground"}`}>
          {t(LAYOUT_LABEL_KEYS[layout])}
        </button>
      ))}
    </div>
  );
}

function redirectTop(url: string) {
  try {
    window.top?.location.assign(url);
  } catch {
    // Browsers can refuse to navigate the embedding site (sandboxed iframes); stay in the iframe.
    window.location.assign(url);
  }
}

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

/** Books the chosen slot, then tells an embedding site and moves on to the confirmation. */
function useBookingSubmit({
  event,
  username,
  slug,
  locale,
  rescheduleUid,
  hashedLink,
  slot,
  timeZone,
  duration,
  recurringCount,
}: {
  event: PublicEventDto;
  username: string;
  slug: string;
  locale: string;
  rescheduleUid?: string;
  hashedLink?: string;
  slot: string | null;
  timeZone: string | null | undefined;
  /** The booker's choice, for events with several lengths. */
  duration: number | undefined;
  recurringCount: number;
}) {
  const navigate = useNavigate();
  const embed = useEmbed();
  const recurring = event.eventType.recurringEvent && !rescheduleUid ? event.eventType.recurringEvent : null;
  // Read once the form shows, which is always after hydration.
  const prefill = useMemo(
    () =>
      slot
        ? prefillFromSearch(event.eventType.bookingFields, new URLSearchParams(window.location.search))
        : {},
    [slot, event.eventType.bookingFields]
  );
  const occurrences =
    slot && timeZone && recurring
      ? recurringDates(new Date(slot), timeZone, { ...recurring, count: recurringCount }).map((date) =>
          date.toISOString()
        )
      : undefined;

  async function book(submission: BookingSubmission) {
    if (!slot || !timeZone) return;
    const rescheduling = submission.rescheduleUid ?? rescheduleUid;
    const { uid, title, status, redirectUrl, seatReferenceUid } = await createBooking({
      data: {
        username,
        slug,
        start: slot,
        timeZone,
        locale,
        responses: submission.responses,
        duration,
        verificationCode: submission.verificationCode,
        recurringCount: recurring ? recurringCount : undefined,
        rescheduleUid: rescheduling,
        hashedLink,
      },
    });
    embed.fire(
      rescheduling ? "rescheduleBookingSuccessfulV2" : "bookingSuccessfulV2",
      bookingSuccessfulPayload({
        uid,
        title,
        status,
        eventTypeId: event.eventType.id,
        startTimes: occurrences ?? [slot],
        durationMinutes: duration ?? event.eventType.length,
      })
    );
    // The host's own thank-you page replaces ours, as in Cal; an embed sends the whole site there.
    if (redirectUrl && embed.embedded) redirectTop(redirectUrl);
    else if (redirectUrl) window.location.assign(redirectUrl);
    else await navigate({ to: "/booking/$uid", params: { uid }, search: { seatReferenceUid } });
  }

  return { book, occurrences, prefill };
}

/**
 * The public booking page for one event type, reached by /$username/$slug or a private link
 * (/d/$link/$slug), which counts a use when someone books through it.
 */
export function BookerPage({
  event,
  locale,
  username,
  slug,
  rescheduleUid,
  hashedLink,
  requestedLayout,
}: {
  event: PublicEventDto;
  locale: string;
  username: string;
  slug: string;
  rescheduleUid?: string;
  hashedLink?: string;
  /** Cal's ?layout= query parameter. */
  requestedLayout?: string;
}) {
  const t = useT();
  const [layout, setLayout] = useState<BookerLayout>(() =>
    initialLayout(event.eventType.bookerLayouts, requestedLayout)
  );
  const [duration, setDuration] = useState(event.eventType.length);
  const [recurringCount, setRecurringCount] = useState(event.eventType.recurringEvent?.count ?? 1);
  const hasDurationChoice = event.eventType.durations.length > 1;
  const slots = useMonthSlots({
    username,
    slug,
    rescheduleUid,
    lockedTimeZone: event.eventType.lockedTimeZone,
    duration: hasDurationChoice ? duration : undefined,
    layout,
    weekStartDay: event.host.weekStartDay,
  });
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [hour12, setHour12] = useStoredHour12();
  const embedTheme = useEmbed().theme;

  const { book, occurrences, prefill } = useBookingSubmit({
    event,
    username,
    slug,
    locale,
    rescheduleUid,
    hashedLink,
    slot: selectedSlot,
    timeZone: slots.timeZone,
    duration: hasDurationChoice ? duration : undefined,
    recurringCount,
  });

  return (
    <HourCycleProvider hour12={hour12}>
      <ThemeScope
        theme={embedTheme === undefined ? event.host.appearance.theme : embedTheme}
        brandColor={event.host.appearance.brandColor}
        darkBrandColor={event.host.appearance.darkBrandColor}>
        <main
          lang={locale}
          className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-8">
          <HydratedFieldset className="grid w-full max-w-6xl overflow-hidden rounded-xl border bg-background md:grid-cols-[18rem_1fr]">
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
            <section className="flex flex-col gap-4 p-6">
              {!selectedSlot && (
                <LayoutSwitcher
                  enabled={event.eventType.bookerLayouts.enabledLayouts}
                  value={layout}
                  onChange={setLayout}
                  t={t}
                />
              )}
              {selectedSlot && slots.timeZone ? (
                <BookingForm
                  slot={selectedSlot}
                  timeZone={slots.timeZone}
                  locale={locale}
                  locations={event.eventType.locations}
                  fields={event.eventType.bookingFields}
                  occurrences={occurrences}
                  prefill={prefill}
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
                <TimesPanel
                  layout={layout}
                  slots={slots}
                  locale={locale}
                  weekStartDay={event.host.weekStartDay}
                  onSelectSlot={setSelectedSlot}
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

export { BOOKER_MESSAGE_KEYS };

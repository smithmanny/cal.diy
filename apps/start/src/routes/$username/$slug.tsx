import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { type ComponentProps, useEffect, useState } from "react";
import { BookerSidebar } from "~/components/booker/BookerSidebar";
import { BookingForm } from "~/components/booker/BookingForm";
import { LOCATION_LABEL_KEYS } from "~/components/booker/locationLabels";
import { SlotPicker } from "~/components/booker/SlotPicker";
import { useMonthSlots } from "~/components/booker/useMonthSlots";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { HourCycleProvider } from "~/lib/hour-cycle";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { NOINDEX_META } from "~/lib/seo";
import { createBooking, getPublicEvent } from "~/server/bookings/functions";

const MESSAGE_KEYS = [
  ...Object.values(LOCATION_LABEL_KEYS),
  "minutes",
  "timezone",
  "no_available_slots",
  "view_previous_month",
  "view_next_month",
  "your_name",
  "email_address",
  "additional_notes",
  "location",
  "phone_number",
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
  const { event, rescheduleUid } = Route.useLoaderData();
  const { locale } = Route.useRouteContext();
  const { username, slug } = Route.useParams();
  const t = useT();
  const navigate = useNavigate();
  const slots = useMonthSlots({ username, slug, rescheduleUid });
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [hour12, setHour12] = useStoredHour12();

  async function book(attendee: Parameters<ComponentProps<typeof BookingForm>["onSubmit"]>[0]) {
    if (!selectedSlot || !slots.timeZone) return;
    const { uid } = await createBooking({
      data: {
        username,
        slug,
        start: selectedSlot,
        timeZone: slots.timeZone,
        locale,
        rescheduleUid,
        ...attendee,
      },
    });
    await navigate({ to: "/booking/$uid", params: { uid } });
  }

  return (
    <HourCycleProvider hour12={hour12}>
      <main className="flex min-h-screen items-start justify-center bg-muted/40 px-4 py-8 md:items-center">
        <HydratedFieldset className="grid w-full max-w-5xl overflow-hidden rounded-xl border bg-background md:grid-cols-[18rem_1fr]">
          <BookerSidebar
            event={event}
            rescheduling={Boolean(rescheduleUid)}
            timeZone={slots.timeZone}
            onTimeZoneChange={slots.setTimeZone}
            t={t}
          />
          <section className="p-6">
            {selectedSlot && slots.timeZone ? (
              <BookingForm
                slot={selectedSlot}
                timeZone={slots.timeZone}
                locale={locale}
                locations={event.eventType.locations}
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
      </main>
    </HourCycleProvider>
  );
}

export const Route = createFileRoute("/$username/$slug")({
  validateSearch: (search: Record<string, unknown>): { rescheduleUid?: string } => ({
    rescheduleUid: typeof search.rescheduleUid === "string" ? search.rescheduleUid : undefined,
  }),
  loaderDeps: ({ search }) => ({ rescheduleUid: search.rescheduleUid }),
  loader: async ({ context, params, deps }) => {
    const [messages, event] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getPublicEvent({ data: params }).catch(() => {
        throw notFound();
      }),
    ]);
    return { messages, event, rescheduleUid: deps.rescheduleUid };
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

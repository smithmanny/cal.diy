import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { type ComponentProps, useState } from "react";
import { BookerSidebar } from "~/components/booker/BookerSidebar";
import { BookingForm } from "~/components/booker/BookingForm";
import { LOCATION_LABEL_KEYS } from "~/components/booker/locationLabels";
import { SlotPicker } from "~/components/booker/SlotPicker";
import { useMonthSlots } from "~/components/booker/useMonthSlots";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
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
];

function BookerPage() {
  const { event, rescheduleUid } = Route.useLoaderData();
  const { locale } = Route.useRouteContext();
  const { username, slug } = Route.useParams();
  const t = useT();
  const navigate = useNavigate();
  const slots = useMonthSlots({ username, slug, rescheduleUid });
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

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
              t={t}
            />
          )}
        </section>
      </HydratedFieldset>
    </main>
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
    ],
  }),
  component: BookerPage,
});

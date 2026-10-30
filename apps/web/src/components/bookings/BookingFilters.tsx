import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { type FormEvent, useEffect, useState } from "react";
import { selectClass } from "~/components/availability/TimeSelect";
import { useT } from "~/lib/i18n";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type BookingSearch = {
  eventTypeId?: number;
  attendee?: string;
  /** Whole days (YYYY-MM-DD) in the host's time zone. */
  from?: string;
  to?: string;
};

export const BOOKING_FILTER_MESSAGE_KEYS = [
  "filter",
  "event_type",
  "all_event_types",
  "name_or_email",
  "start_date",
  "end_date",
  "clear_filters",
];

/** Router search values arrive JSON-parsed (`?attendee=42` is a number), so normalize them. */
export function parseBookingSearch(search: Record<string, unknown>): BookingSearch {
  const eventTypeId = Number(search.eventTypeId);
  const text = (value: unknown) => (value === undefined || value === null ? "" : String(value).trim());
  const day = (value: unknown) => (DAY.test(text(value)) ? text(value) : undefined);
  return {
    eventTypeId: Number.isInteger(eventTypeId) && eventTypeId > 0 ? eventTypeId : undefined,
    attendee: text(search.attendee).slice(0, 200) || undefined,
    from: day(search.from),
    to: day(search.to),
  };
}

export function hasBookingSearch(search: BookingSearch): boolean {
  return Boolean(search.eventTypeId || search.attendee || search.from || search.to);
}

export function BookingFilters({
  search,
  eventTypes,
  onChange,
}: {
  search: BookingSearch;
  eventTypes: { id: number; title: string }[];
  onChange: (search: BookingSearch) => void;
}) {
  const t = useT();
  const [attendee, setAttendee] = useState(search.attendee ?? "");
  useEffect(() => setAttendee(search.attendee ?? ""), [search.attendee]);

  function submitAttendee(event: FormEvent) {
    event.preventDefault();
    onChange({ ...search, attendee: attendee.trim() || undefined });
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2" role="search" aria-label={t("filter")}>
      <select
        aria-label={t("event_type")}
        className={selectClass}
        value={search.eventTypeId ?? ""}
        onChange={(event) =>
          onChange({ ...search, eventTypeId: event.target.value ? Number(event.target.value) : undefined })
        }>
        <option value="">{t("all_event_types")}</option>
        {eventTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.title}
          </option>
        ))}
      </select>
      <form onSubmit={submitAttendee}>
        <Input
          type="search"
          size="sm"
          className="w-56"
          aria-label={t("name_or_email")}
          placeholder={t("name_or_email")}
          value={attendee}
          onChange={(event) => setAttendee(event.target.value)}
          onBlur={submitAttendee}
        />
      </form>
      <Input
        type="date"
        size="sm"
        className="w-40"
        aria-label={t("start_date")}
        value={search.from ?? ""}
        onChange={(event) => onChange({ ...search, from: event.target.value || undefined })}
      />
      <Input
        type="date"
        size="sm"
        className="w-40"
        aria-label={t("end_date")}
        value={search.to ?? ""}
        onChange={(event) => onChange({ ...search, to: event.target.value || undefined })}
      />
      {hasBookingSearch(search) && (
        <Button size="sm" variant="ghost" onClick={() => onChange({})}>
          {t("clear_filters")}
        </Button>
      )}
    </div>
  );
}

import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Textarea } from "@coss/ui/components/textarea";
import { ArrowLeftIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { formatLongDate, formatTime, localeUsesHour12 } from "~/lib/date-utils";
import { errorMessageKey, errorMessageValues } from "~/lib/errors";
import { useHour12 } from "~/lib/hour-cycle";
import type { TFunction } from "~/lib/i18n";
import type { CreateBookingInput, PublicEventLocation } from "~/server/bookings/types";
import { FormError } from "../AuthCard";
import { LOCATION_LABEL_KEYS } from "./locationLabels";

type Attendee = Pick<
  CreateBookingInput,
  "name" | "email" | "notes" | "locationType" | "attendeePhone" | "rescheduleUid"
>;

type SubmitError = { key: string; values?: Record<string, string | number> };

export function BookingForm({
  slot,
  timeZone,
  locale,
  locations,
  onBack,
  onSubmit,
  t,
}: {
  slot: string;
  timeZone: string;
  locale: string;
  locations: PublicEventLocation[];
  onBack: () => void;
  onSubmit: (attendee: Attendee) => Promise<void>;
  t: TFunction;
}) {
  const [locationType, setLocationType] = useState(locations[0]?.type ?? "");
  const hour12 = useHour12() ?? localeUsesHour12(locale);
  const [error, setError] = useState<SubmitError | null>(null);
  const [lastAttendee, setLastAttendee] = useState<Attendee | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(attendee: Attendee) {
    setSubmitting(true);
    setError(null);
    setLastAttendee(attendee);
    try {
      await onSubmit(attendee);
    } catch (thrown) {
      setError({ key: errorMessageKey(thrown), values: errorMessageValues(thrown) });
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) || "") || undefined;
    void submit({
      name: String(form.get("name")),
      email: String(form.get("email")),
      notes: optional("notes"),
      locationType: locationType || undefined,
      attendeePhone: optional("phone"),
    });
  }

  // The host allows one upcoming booking per person, and offered to move the existing one here.
  const rescheduleOffer =
    error?.key === "booker_limit_exceeded_error_reschedule" && typeof error.values?.rescheduleUid === "string"
      ? { uid: error.values.rescheduleUid, date: String(error.values.date ?? "") }
      : null;

  return (
    <form method="post" onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" onClick={onBack} type="button">
        <ArrowLeftIcon />
        {t("back")}
      </Button>
      <p className="font-medium">
        {formatLongDate(slot, timeZone, locale)}, {formatTime(slot, timeZone, locale, hour12)}
      </p>
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("your_name")}
        <Input name="name" required maxLength={200} autoComplete="name" />
      </label>
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("email_address")}
        <Input name="email" type="email" required maxLength={320} autoComplete="email" />
      </label>
      {locations.length > 1 && (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 font-medium">{t("location")}</legend>
          {locations.map((location) => (
            <label key={location.type} className="flex items-center gap-2">
              <input
                type="radio"
                name="location"
                value={location.type}
                checked={locationType === location.type}
                onChange={() => setLocationType(location.type)}
              />
              {t(LOCATION_LABEL_KEYS[location.type] ?? location.type)}
            </label>
          ))}
        </fieldset>
      )}
      {locationType === "phone" && (
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("phone_number")}
          <Input name="phone" type="tel" required autoComplete="tel" />
        </label>
      )}
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("additional_notes")}
        <Textarea name="notes" rows={3} maxLength={5000} />
      </label>
      {rescheduleOffer && lastAttendee ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border p-3 text-sm">
          <p>
            {t("booker_limit_exceeded_error_reschedule", {
              date: `${formatLongDate(rescheduleOffer.date, timeZone, locale)}, ${formatTime(rescheduleOffer.date, timeZone, locale, hour12)}`,
            })}
          </p>
          <Button
            type="button"
            className="self-start"
            disabled={submitting}
            onClick={() => submit({ ...lastAttendee, rescheduleUid: rescheduleOffer.uid })}>
            {t("reschedule")}
          </Button>
        </div>
      ) : (
        <FormError message={error && t(error.key, error.values)} />
      )}
      <Button type="submit" disabled={submitting}>
        {submitting ? t("loading") : t("confirm")}
      </Button>
    </form>
  );
}

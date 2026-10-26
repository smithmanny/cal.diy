import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Textarea } from "@coss/ui/components/textarea";
import { ArrowLeftIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { formatLongDate, formatTime } from "~/lib/date-utils";
import { errorMessageKey } from "~/lib/errors";
import type { TFunction } from "~/lib/i18n";
import type { CreateBookingInput, PublicEventLocation } from "~/server/bookings/types";
import { FormError } from "../AuthCard";
import { LOCATION_LABEL_KEYS } from "./locationLabels";

type Attendee = Pick<CreateBookingInput, "name" | "email" | "notes" | "locationType" | "attendeePhone">;

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
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) || "") || undefined;
    setSubmitting(true);
    setErrorKey(null);
    try {
      await onSubmit({
        name: String(form.get("name")),
        email: String(form.get("email")),
        notes: optional("notes"),
        locationType: locationType || undefined,
        attendeePhone: optional("phone"),
      });
    } catch (error) {
      setErrorKey(errorMessageKey(error));
      setSubmitting(false);
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" onClick={onBack} type="button">
        <ArrowLeftIcon />
        {t("back")}
      </Button>
      <p className="font-medium">
        {formatLongDate(slot, timeZone, locale)}, {formatTime(slot, timeZone, locale)}
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
      <FormError message={errorKey && t(errorKey)} />
      <Button type="submit" disabled={submitting}>
        {submitting ? t("loading") : t("confirm")}
      </Button>
    </form>
  );
}

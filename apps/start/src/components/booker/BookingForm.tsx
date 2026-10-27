import { Button } from "@coss/ui/components/button";
import { ArrowLeftIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  type BookingField,
  type BookingView,
  isFieldHidden,
  isFieldInView,
  validateBookingResponses,
} from "~/lib/booking-fields";
import { formatLongDate, formatTime, localeUsesHour12 } from "~/lib/date-utils";
import { errorMessageKey, errorMessageValues } from "~/lib/errors";
import { useHour12 } from "~/lib/hour-cycle";
import type { TFunction } from "~/lib/i18n";
import type { PublicEventLocation } from "~/server/bookings/types";
import { FormError } from "../AuthCard";
import { BookingFieldInput } from "./BookingFieldInput";

type BookingSubmission = { responses: Record<string, unknown>; rescheduleUid?: string };

type SubmitError = { key: string; values?: Record<string, string | number> };
type FieldErrors = Record<string, SubmitError>;

function initialValues(locations: PublicEventLocation[]): Record<string, unknown> {
  return locations.length ? { location: { value: locations[0].type, optionValue: "" } } : {};
}

export function BookingForm({
  slot,
  timeZone,
  locale,
  locations,
  fields,
  view,
  onBack,
  onSubmit,
  t,
}: {
  slot: string;
  timeZone: string;
  locale: string;
  locations: PublicEventLocation[];
  fields: BookingField[];
  view: BookingView;
  onBack: () => void;
  onSubmit: (submission: BookingSubmission) => Promise<void>;
  t: TFunction;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(locations));
  const hour12 = useHour12() ?? localeUsesHour12(locale);
  const [error, setError] = useState<SubmitError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [lastSubmission, setLastSubmission] = useState<BookingSubmission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const locationTypes = locations.map((location) => location.type);
  const shown = fields.filter((field) => {
    if (!isFieldInView(field, view)) return false;
    // The location question stays for a lone location that needs the booker's number.
    if (field.type === "radioInput") return !field.hidden && locations.length > 0;
    return !isFieldHidden(field);
  });

  async function submit(submission: BookingSubmission) {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    setLastSubmission(submission);
    try {
      await onSubmit(submission);
    } catch (thrown) {
      const values = errorMessageValues(thrown);
      const failed = { key: errorMessageKey(thrown), values };
      if (typeof values?.field === "string") setFieldErrors({ [values.field]: failed });
      else setError(failed);
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { errors } = validateBookingResponses(fields, values, { view, locationTypes });
    if (errors.length) {
      setFieldErrors(
        Object.fromEntries(errors.map(({ field, key, values: v }) => [field, { key, values: v }]))
      );
      return;
    }
    void submit({ responses: values });
  }

  // The host allows one upcoming booking per person, and offered to move the existing one here.
  const rescheduleOffer =
    error?.key === "booker_limit_exceeded_error_reschedule" && typeof error.values?.rescheduleUid === "string"
      ? { uid: error.values.rescheduleUid, date: String(error.values.date ?? "") }
      : null;

  return (
    <form method="post" noValidate onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" onClick={onBack} type="button">
        <ArrowLeftIcon />
        {t("back")}
      </Button>
      <p className="font-medium">
        {formatLongDate(slot, timeZone, locale)}, {formatTime(slot, timeZone, locale, hour12)}
      </p>
      {shown.map((field) => {
        const fieldError = fieldErrors[field.name];
        return (
          <BookingFieldInput
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
            error={fieldError ? t(fieldError.key, fieldError.values) : null}
            locations={locations}
            t={t}
          />
        );
      })}
      {rescheduleOffer && lastSubmission ? (
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
            onClick={() => submit({ ...lastSubmission, rescheduleUid: rescheduleOffer.uid })}>
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

export type { BookingSubmission };

import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
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

type BookingSubmission = {
  responses: Record<string, unknown>;
  rescheduleUid?: string;
  verificationCode?: string;
};

type SubmitError = { key: string; values?: Record<string, string | number> };
type FieldErrors = Record<string, SubmitError>;

/** Cal's booker email verification: a code is emailed, then typed in before booking. */
function VerificationCodeStep({
  code,
  onCodeChange,
  error,
  onResend,
  sending,
  t,
}: {
  code: string;
  onCodeChange: (code: string) => void;
  error: string | null;
  onResend: () => void;
  sending: boolean;
  t: TFunction;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
      <p className="text-muted-foreground">{t("verification_code_sent")}</p>
      <label htmlFor="booking-verification-code" className="font-medium">
        {t("verification_code")}
      </label>
      <Input
        id="booking-verification-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder={t("email_verification_code_placeholder")}
        aria-invalid={error ? true : undefined}
        value={code}
        onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, ""))}
      />
      {error && <p className="text-destructive-foreground">{error}</p>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={sending}
        onClick={onResend}>
        {t("resend")}
      </Button>
    </div>
  );
}

function initialValues(
  locations: PublicEventLocation[],
  prefill: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...prefill,
    ...(locations.length ? { location: { value: locations[0].type, optionValue: "" } } : {}),
  };
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
  onSendCode,
  occurrences,
  prefill,
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
  /** Start times of every occurrence when booking a recurring event. */
  occurrences?: string[];
  /** Set when the event type requires booker email verification; emails a code. */
  onSendCode?: (email: string) => Promise<void>;
  /** Starting answers, from Cal's URL prefill. */
  prefill?: Record<string, unknown>;
  t: TFunction;
}) {
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(locations, prefill));
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
    if (onSendCode && !codeSent) {
      void sendCode();
      return;
    }
    void submit({ responses: values, verificationCode: onSendCode ? code : undefined });
  }

  async function sendCode() {
    if (!onSendCode) return;
    setSendingCode(true);
    setError(null);
    try {
      await onSendCode(String(values.email ?? ""));
      setCodeSent(true);
    } catch (thrown) {
      setError({ key: errorMessageKey(thrown), values: errorMessageValues(thrown) });
    } finally {
      setSendingCode(false);
    }
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
      {occurrences && occurrences.length > 1 ? (
        <ul className="font-medium text-sm">
          {occurrences.map((start) => (
            <li key={start}>
              {formatLongDate(start, timeZone, locale)}, {formatTime(start, timeZone, locale, hour12)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-medium">
          {formatLongDate(slot, timeZone, locale)}, {formatTime(slot, timeZone, locale, hour12)}
        </p>
      )}
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
      {codeSent && (
        <VerificationCodeStep
          code={code}
          onCodeChange={setCode}
          error={fieldErrors.verificationCode ? t(fieldErrors.verificationCode.key) : null}
          onResend={() => void sendCode()}
          sending={sendingCode}
          t={t}
        />
      )}
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
      <Button type="submit" disabled={submitting || sendingCode}>
        {submitting ? t("loading") : t("confirm")}
      </Button>
    </form>
  );
}

export type { BookingSubmission };

import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Textarea } from "@coss/ui/components/textarea";
import { PlusIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { selectClass } from "~/components/availability/TimeSelect";
import { type BookingField, fieldLabel, fieldPlaceholder, type LocationResponse } from "~/lib/booking-fields";
import type { TFunction } from "~/lib/i18n";
import type { PublicEventLocation } from "~/server/bookings/types";
import { LOCATION_LABEL_KEYS } from "./locationLabels";

type FieldProps = {
  field: BookingField;
  value: unknown;
  onChange: (value: unknown) => void;
  error: string | null;
  locations: PublicEventLocation[];
  t: TFunction;
};

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asList = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
const toggle = (list: string[], item: string, on: boolean) =>
  on ? [...list, item] : list.filter((existing) => existing !== item);

function FieldShell({
  field,
  error,
  t,
  children,
  asGroup,
}: Pick<FieldProps, "field" | "error" | "t"> & { children: ReactNode; asGroup?: boolean }) {
  const id = `booking-field-${field.name}`;
  const label = (
    <>
      {fieldLabel(field, t)}
      {!field.required && <span className="ms-1 font-normal text-muted-foreground">({t("optional")})</span>}
    </>
  );
  const message = error && (
    <p id={`${id}-error`} className="text-destructive-foreground text-sm">
      {error}
    </p>
  );
  if (asGroup)
    return (
      <fieldset className="flex flex-col gap-2 text-sm" aria-describedby={error ? `${id}-error` : undefined}>
        <legend className="mb-1 font-medium">{label}</legend>
        {children}
        {message}
      </fieldset>
    );
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {children}
      {message}
    </div>
  );
}

function inputProps(field: BookingField, error: string | null, t: TFunction) {
  const id = `booking-field-${field.name}`;
  return {
    id,
    name: field.name,
    required: field.required,
    placeholder: fieldPlaceholder(field, t) || undefined,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
}

const TEXT_INPUT_TYPES: Partial<Record<BookingField["type"], { type: string; autoComplete?: string }>> = {
  name: { type: "text", autoComplete: "name" },
  email: { type: "email", autoComplete: "email" },
  phone: { type: "tel", autoComplete: "tel" },
  address: { type: "text", autoComplete: "street-address" },
  text: { type: "text" },
  number: { type: "number" },
  url: { type: "text" },
};

function MultiEmailInput({ field, value, onChange, error, t }: FieldProps) {
  const emails = asList(value);
  const shown = emails.length ? emails : [];
  const update = (index: number, next: string | null) => {
    const copy = [...shown];
    if (next === null) copy.splice(index, 1);
    else copy[index] = next;
    onChange(copy);
  };
  return (
    <FieldShell field={field} error={error} t={t} asGroup>
      {shown.map((email, index) => (
        // Guests are positional; the index is their identity while editing.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <div key={index} className="flex items-center gap-2">
          <Input
            type="email"
            value={email}
            aria-label={`${fieldLabel(field, t)} ${index + 1}`}
            placeholder={fieldPlaceholder(field, t) || undefined}
            onChange={(event) => update(index, event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("remove")}
            onClick={() => update(index, null)}>
            <XIcon />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...shown, ""])}>
        <PlusIcon />
        {fieldLabel(field, t)}
      </Button>
    </FieldShell>
  );
}

function OptionsInput({ field, value, onChange, error, t }: FieldProps) {
  const multiple = field.type === "checkbox" || field.type === "multiselect";
  const chosen = multiple ? asList(value) : [asString(value)];
  return (
    <FieldShell field={field} error={error} t={t} asGroup>
      {(field.options ?? []).map((option) => (
        <label key={option.value} className="flex items-center gap-2">
          <input
            type={multiple ? "checkbox" : "radio"}
            name={field.name}
            value={option.value}
            checked={chosen.includes(option.value)}
            onChange={(event) =>
              onChange(multiple ? toggle(chosen, option.value, event.target.checked) : option.value)
            }
          />
          {option.label}
        </label>
      ))}
    </FieldShell>
  );
}

/** The location question: a choice among the event's locations, plus the booker's number if needed. */
function LocationInput({ field, value, onChange, error, locations, t }: FieldProps) {
  const current = (value ?? { value: locations[0]?.type ?? "", optionValue: "" }) as LocationResponse;
  const optionInput = field.optionsInputs?.[current.value];
  const showChoice = locations.length > 1;
  const numberInput = optionInput?.type === "phone" && (
    <label className="flex flex-col gap-1.5 font-medium text-sm">
      {t("phone_number")}
      <Input
        name="location-phone"
        type="tel"
        required
        autoComplete="tel"
        value={current.optionValue}
        onChange={(event) => onChange({ ...current, optionValue: event.target.value })}
      />
    </label>
  );
  if (!showChoice)
    return numberInput ? (
      <div className="flex flex-col gap-1.5">
        {numberInput}
        {error && <p className="text-destructive-foreground text-sm">{error}</p>}
      </div>
    ) : null;
  return (
    <FieldShell field={field} error={error} t={t} asGroup>
      {locations.map((location) => (
        <label key={location.type} className="flex items-center gap-2">
          <input
            type="radio"
            name="location"
            value={location.type}
            checked={current.value === location.type}
            onChange={() => onChange({ value: location.type, optionValue: "" })}
          />
          {t(LOCATION_LABEL_KEYS[location.type] ?? location.type)}
        </label>
      ))}
      {numberInput}
    </FieldShell>
  );
}

export function BookingFieldInput(props: FieldProps) {
  const { field, value, onChange, error, t } = props;
  switch (field.type) {
    case "radioInput":
      return <LocationInput {...props} />;
    case "multiemail":
      return <MultiEmailInput {...props} />;
    case "checkbox":
    case "multiselect":
    case "radio":
      return <OptionsInput {...props} />;
    case "boolean":
      return (
        <div className="flex flex-col gap-1.5 text-sm">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              {...inputProps(field, error, t)}
              checked={value === true}
              onChange={(event) => onChange(event.target.checked)}
            />
            {fieldLabel(field, t)}
          </label>
          {error && (
            <p id={`booking-field-${field.name}-error`} className="text-destructive-foreground text-sm">
              {error}
            </p>
          )}
        </div>
      );
    case "select":
      return (
        <FieldShell field={field} error={error} t={t}>
          <select
            {...inputProps(field, error, t)}
            className={selectClass}
            value={asString(value)}
            onChange={(event) => onChange(event.target.value)}>
            <option value="">{fieldPlaceholder(field, t) || t("select")}</option>
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FieldShell>
      );
    case "textarea":
      return (
        <FieldShell field={field} error={error} t={t}>
          <Textarea
            {...inputProps(field, error, t)}
            rows={3}
            maxLength={field.maxLength}
            value={asString(value)}
            onChange={(event) => onChange(event.target.value)}
          />
        </FieldShell>
      );
    default:
      return (
        <FieldShell field={field} error={error} t={t}>
          <Input
            {...inputProps(field, error, t)}
            {...TEXT_INPUT_TYPES[field.type]}
            maxLength={field.maxLength}
            value={asString(value)}
            onChange={(event) => onChange(event.target.value)}
          />
        </FieldShell>
      );
  }
}

export const BOOKING_FIELD_MESSAGE_KEYS = [
  "your_name",
  "email_address",
  "phone_number",
  "location",
  "what_is_this_meeting_about",
  "additional_notes",
  "share_additional_notes",
  "additional_guests",
  "reason_for_reschedule",
  "reschedule_placeholder",
  "email",
  "optional",
  "select",
  "remove",
  "error_required_field",
  "email_validation_error",
  "exclude_emails_match_found_error_message",
  "require_emails_no_match_found_error_message",
  "duplicate_email",
  "invalid_number",
  "url_validation_error",
  "max_characters_allowed",
  "min_characters_required",
  "booking_question_number_error",
  "booking_question_too_many_emails",
];

import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Switch } from "@coss/ui/components/switch";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { selectClass } from "~/components/availability/TimeSelect";
import {
  type BookingFieldInput,
  bookingFieldInputSchema,
  FIELD_NAME_PATTERN,
  fieldLabel,
  LENGTH_FIELD_TYPES,
  OPTION_FIELD_TYPES,
  USER_FIELD_TYPES,
} from "~/lib/booking-fields";
import type { TFunction } from "~/lib/i18n";
import { Field } from "./EditorLayout";

const TYPE_LABEL_KEYS: Record<string, string> = {
  ...Object.fromEntries(USER_FIELD_TYPES.map(({ type, labelKey }) => [type, labelKey])),
  name: "name",
  radioInput: "location",
};

const isSystem = (field: BookingFieldInput) => Boolean(field.editable && field.editable !== "user");
const canToggle = (field: BookingFieldInput) => !isSystem(field) || field.editable === "system-but-optional";

/** Cal's getFieldIdentifier: the label, lowercased, with anything else turned into dashes. */
function identifierFrom(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function questionError(field: BookingFieldInput, otherNames: string[]): string | null {
  if (!FIELD_NAME_PATTERN.test(field.name)) return "ignore_special_characters_booking_questions";
  if (otherNames.includes(field.name)) return "form_builder_field_already_exists";
  const parsed = bookingFieldInputSchema.safeParse(field);
  if (parsed.success) return null;
  const message = parsed.error.issues[0]?.message ?? "";
  return message.startsWith("booking_question_") ? message : "error_required_field";
}

function OptionsEditor({
  options,
  onChange,
  t,
}: {
  options: { label: string; value: string }[];
  onChange: (options: { label: string; value: string }[]) => void;
  t: TFunction;
}) {
  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="mb-1 font-medium">{t("options")}</legend>
      {options.map((option, index) => (
        // Options are edited in place, so their position is their identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <div key={index} className="flex items-center gap-2">
          <Input
            aria-label={`${t("option_label")} ${index + 1}`}
            value={option.label}
            maxLength={500}
            // Like Cal, an option's stored value is its label.
            onChange={(event) =>
              onChange(
                options.map((current, i) =>
                  i === index ? { label: event.target.value, value: event.target.value.trim() } : current
                )
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("remove")}
            onClick={() => onChange(options.filter((_, i) => i !== index))}>
            <XIcon />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...options, { label: "", value: "" }])}>
        <PlusIcon />
        {t("add_an_option")}
      </Button>
    </fieldset>
  );
}

function LengthFields({
  draft,
  update,
  t,
}: {
  draft: BookingFieldInput;
  update: (patch: Partial<BookingFieldInput>) => void;
  t: TFunction;
}) {
  const toLength = (value: string) => (value === "" ? undefined : Math.max(0, Math.floor(Number(value))));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("min_characters")}>
        <Input
          type="number"
          min={0}
          value={draft.minLength ?? ""}
          onChange={(event) => update({ minLength: toLength(event.target.value) })}
        />
      </Field>
      <Field label={t("max_characters")}>
        <Input
          type="number"
          min={1}
          value={draft.maxLength ?? ""}
          onChange={(event) => update({ maxLength: toLength(event.target.value) || undefined })}
        />
      </Field>
    </div>
  );
}

function QuestionForm({
  initial,
  otherNames,
  onSave,
  onCancel,
  t,
}: {
  initial: BookingFieldInput;
  otherNames: string[];
  onSave: (field: BookingFieldInput) => void;
  onCancel: () => void;
  t: TFunction;
}) {
  const [draft, setDraft] = useState(initial);
  const [nameTouched, setNameTouched] = useState(Boolean(initial.name));
  const [error, setError] = useState<string | null>(null);
  const system = isSystem(draft);
  const update = (patch: Partial<BookingFieldInput>) => setDraft((current) => ({ ...current, ...patch }));
  const headingId = useId();

  function save() {
    const cleaned = {
      ...draft,
      options: draft.options?.filter((option) => option.value),
    };
    const failed = questionError(cleaned, otherNames);
    if (failed) {
      setError(failed);
      return;
    }
    onSave(cleaned);
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
      <h3 id={headingId} className="font-medium text-sm">
        {t(initial.name ? "edit_booking_question" : "add_a_booking_question")}
      </h3>
      {!system && (
        <Field label={t("input_type")}>
          <select
            className={selectClass}
            value={draft.type}
            onChange={(event) => update({ type: event.target.value as BookingFieldInput["type"] })}>
            {USER_FIELD_TYPES.map(({ type, labelKey }) => (
              <option key={type} value={type}>
                {t(labelKey)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={t("label")}>
        <Input
          value={draft.label ?? ""}
          maxLength={1000}
          placeholder={draft.defaultLabel ? t(draft.defaultLabel) : undefined}
          onChange={(event) =>
            update({
              label: event.target.value,
              ...(nameTouched ? {} : { name: identifierFrom(event.target.value) }),
            })
          }
        />
      </Field>
      {!system && (
        <Field label={t("identifier")}>
          <Input
            value={draft.name}
            maxLength={100}
            onChange={(event) => {
              setNameTouched(true);
              update({ name: event.target.value });
            }}
          />
        </Field>
      )}
      {!OPTION_FIELD_TYPES.has(draft.type) && draft.type !== "boolean" && draft.type !== "radioInput" && (
        <Field label={t("placeholder")}>
          <Input
            value={draft.placeholder ?? ""}
            maxLength={500}
            placeholder={draft.defaultPlaceholder ? t(draft.defaultPlaceholder) : undefined}
            onChange={(event) => update({ placeholder: event.target.value })}
          />
        </Field>
      )}
      {OPTION_FIELD_TYPES.has(draft.type) && !system && (
        <OptionsEditor options={draft.options ?? []} onChange={(options) => update({ options })} t={t} />
      )}
      {LENGTH_FIELD_TYPES.has(draft.type) && <LengthFields draft={draft} update={update} t={t} />}
      {draft.type === "email" && (
        <>
          <Field label={t("exclude_emails_that_contain")}>
            <Input
              value={draft.excludeEmails ?? ""}
              placeholder="gmail.com, @yahoo.com"
              onChange={(event) => update({ excludeEmails: event.target.value })}
            />
          </Field>
          <Field label={t("require_emails_that_contain")}>
            <Input
              value={draft.requireEmails ?? ""}
              placeholder="acme.com"
              onChange={(event) => update({ requireEmails: event.target.value })}
            />
          </Field>
        </>
      )}
      {canToggle(draft) && (
        <label className="flex items-center gap-2 font-medium text-sm">
          <Switch checked={draft.required} onCheckedChange={(required) => update({ required })} />
          {t("required")}
        </label>
      )}
      <FormError message={error && t(error)} />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save}>
          {t("save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

const NEW_QUESTION: BookingFieldInput = { name: "", type: "text", label: "", required: true, hidden: false };

function QuestionRow({
  field,
  index,
  count,
  onEdit,
  onChange,
  onMove,
  onDelete,
  t,
}: {
  field: BookingFieldInput;
  index: number;
  count: number;
  onEdit: () => void;
  onChange: (field: BookingFieldInput) => void;
  onMove: (offset: number) => void;
  onDelete: () => void;
  t: TFunction;
}) {
  const label = fieldLabel(field, t);
  return (
    <li className="flex flex-wrap items-center gap-2 border-b py-2 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate font-medium text-sm ${field.hidden ? "text-muted-foreground" : ""}`}>
          {label}
        </span>
        <span className="flex gap-1">
          <Badge variant="outline">{t(TYPE_LABEL_KEYS[field.type] ?? field.type)}</Badge>
          <Badge variant="secondary">{t(field.required ? "required" : "optional")}</Badge>
          {field.hidden && <Badge variant="secondary">{t("hidden")}</Badge>}
        </span>
      </div>
      {canToggle(field) && (
        <Switch
          aria-label={`${t("show_on_booking_page")}: ${label}`}
          checked={!field.hidden}
          onCheckedChange={(shown) => onChange({ ...field, hidden: !shown })}
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`${t("move_up")}: ${label}`}
        disabled={index === 0}
        onClick={() => onMove(-1)}>
        <ArrowUpIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`${t("move_down")}: ${label}`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}>
        <ArrowDownIcon />
      </Button>
      {field.type !== "radioInput" && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${t("edit")}: ${label}`}
          onClick={onEdit}>
          <PencilIcon />
        </Button>
      )}
      {!isSystem(field) && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${t("delete")}: ${label}`}
          onClick={onDelete}>
          <Trash2Icon />
        </Button>
      )}
    </li>
  );
}

export function BookingQuestionsEditor({
  value,
  onChange,
  t,
}: {
  value: BookingFieldInput[];
  onChange: (fields: BookingFieldInput[]) => void;
  t: TFunction;
}) {
  // The index being edited, or "new" while adding a question.
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const names = (except?: number) => value.filter((_, i) => i !== except).map((field) => field.name);

  function move(index: number, offset: number) {
    const next = [...value];
    const [field] = next.splice(index, 1);
    next.splice(index + offset, 0, field);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {value.map((field, index) =>
          editing === index ? (
            <li key={field.name} className="py-2">
              <QuestionForm
                initial={field}
                otherNames={names(index)}
                onSave={(saved) => {
                  onChange(value.map((current, i) => (i === index ? saved : current)));
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
                t={t}
              />
            </li>
          ) : (
            <QuestionRow
              key={field.name}
              field={field}
              index={index}
              count={value.length}
              onEdit={() => setEditing(index)}
              onChange={(changed) => onChange(value.map((current, i) => (i === index ? changed : current)))}
              onMove={(offset) => move(index, offset)}
              onDelete={() => onChange(value.filter((_, i) => i !== index))}
              t={t}
            />
          )
        )}
      </ul>
      {editing === "new" ? (
        <QuestionForm
          initial={NEW_QUESTION}
          otherNames={names()}
          onSave={(saved) => {
            // New questions go before the notes and guests, like Cal.
            const notesIndex = value.findIndex((field) => field.name === "title");
            const at = notesIndex === -1 ? value.length : notesIndex;
            onChange([...value.slice(0, at), saved, ...value.slice(at)]);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
          t={t}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setEditing("new")}>
          <PlusIcon />
          {t("add_a_booking_question")}
        </Button>
      )}
    </div>
  );
}

export const BOOKING_QUESTIONS_MESSAGE_KEYS = [
  ...USER_FIELD_TYPES.map(({ labelKey }) => labelKey),
  "booking_questions_title",
  "add_a_booking_question",
  "edit_booking_question",
  "input_type",
  "label",
  "identifier",
  "placeholder",
  "options",
  "option_label",
  "add_an_option",
  "min_characters",
  "max_characters",
  "exclude_emails_that_contain",
  "require_emails_that_contain",
  "required",
  "optional",
  "hidden",
  "show_on_booking_page",
  "move_up",
  "move_down",
  "edit",
  "delete",
  "remove",
  "cancel",
  "name",
  "location",
  "your_name",
  "email_address",
  "phone_number",
  "what_is_this_meeting_about",
  "additional_notes",
  "share_additional_notes",
  "additional_guests",
  "reason_for_reschedule",
  "reschedule_placeholder",
  "ignore_special_characters_booking_questions",
  "form_builder_field_already_exists",
  "error_required_field",
  "booking_question_options_required",
  "booking_question_length_error",
  "booking_question_type_not_allowed",
  "booking_question_system_field_removed",
];

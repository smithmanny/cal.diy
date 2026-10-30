import { Input } from "@coss/ui/components/input";
import { Switch } from "@coss/ui/components/switch";
import { selectClass } from "~/components/availability/TimeSelect";
import type { TFunction } from "~/lib/i18n";
import type { EventTypeInput } from "~/server/event-types/types";
import { Field, type SetField } from "./EditorLayout";

// Cal's multiple duration choices, in minutes.
const DURATION_OPTIONS = [
  5, 10, 15, 20, 25, 30, 45, 50, 60, 75, 80, 90, 120, 150, 180, 240, 300, 360, 420, 480,
];

type EditorProps = { form: EventTypeInput; set: SetField; t: TFunction };

function toggleDuration(list: number[], minutes: number, on: boolean): number[] {
  const next = on ? [...list, minutes] : list.filter((item) => item !== minutes);
  return [...new Set(next)].sort((a, b) => a - b);
}

function MultipleDurations({ form, set, t }: EditorProps) {
  const chosen = form.multipleDuration ?? [];
  const options = [...new Set([...DURATION_OPTIONS, ...chosen])].sort((a, b) => a - b);
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">{t("available_durations")}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {options.map((minutes) => (
            <label key={minutes} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={chosen.includes(minutes)}
                onChange={(event) => {
                  const next = toggleDuration(chosen, minutes, event.target.checked);
                  set("multipleDuration", next);
                  if (next.length && !next.includes(form.length)) set("length", next[0]);
                }}
              />
              {t("multiple_duration_mins", { count: minutes })}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t("default_duration")}>
        <select
          className={`${selectClass} max-w-40`}
          value={chosen.includes(form.length) ? form.length : ""}
          onChange={(event) => set("length", Number(event.target.value))}>
          {!chosen.length && <option value="">{t("default_duration_no_options")}</option>}
          {chosen.map((minutes) => (
            <option key={minutes} value={minutes}>
              {t("multiple_duration_mins", { count: minutes })}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

/** The event's length, or (Cal's "Allow multiple durations") the lengths a booker picks from. */
export function DurationEditor({ form, set, t }: EditorProps) {
  const multiple = form.multipleDuration !== null;
  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      {multiple ? (
        <MultipleDurations form={form} set={set} t={t} />
      ) : (
        <Field label={`${t("duration")} (${t("minutes")})`}>
          <Input
            type="number"
            min={1}
            max={1440}
            className="max-w-40"
            value={form.length}
            onChange={(event) => set("length", Number(event.target.value))}
          />
        </Field>
      )}
      <label className="flex items-center gap-2 font-medium text-sm">
        <Switch
          checked={multiple}
          onCheckedChange={(checked) => set("multipleDuration", checked ? [form.length] : null)}
        />
        {t("allow_multiple_durations")}
      </label>
    </div>
  );
}

export const DURATION_MESSAGE_KEYS = [
  "duration",
  "minutes",
  "available_durations",
  "default_duration",
  "default_duration_no_options",
  "multiple_duration_mins",
  "allow_multiple_durations",
  "event_setup_multiple_duration_error",
  "event_setup_multiple_duration_default_error",
];

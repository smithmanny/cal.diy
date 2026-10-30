import { Input } from "@coss/ui/components/input";
import { selectClass } from "~/components/availability/TimeSelect";
import type { TFunction } from "~/lib/i18n";
import type { EventTypeInput } from "~/server/event-types/types";
import { type SetField, ToggleBlock, withoutLinks } from "./EditorLayout";

type Rule = NonNullable<EventTypeInput["recurringEvent"]>;

// Cal's defaults for a new recurring event: weekly, 12 times.
const DEFAULT_RULE: Rule = { freq: 2, interval: 1, count: 12 };
const FREQUENCIES: { freq: Rule["freq"]; key: string }[] = [
  { freq: 2, key: "weekly" },
  { freq: 1, key: "monthly" },
  { freq: 0, key: "yearly" },
];

const whole = (value: string, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.floor(Number(value) || min)));

/** Cal's "Recurring event": repeats every N weeks/months/years, up to a number of occurrences. */
export function RecurringEditor({ form, set, t }: { form: EventTypeInput; set: SetField; t: TFunction }) {
  const rule = form.recurringEvent ?? DEFAULT_RULE;
  const update = (patch: Partial<Rule>) => set("recurringEvent", { ...rule, ...patch });
  return (
    <ToggleBlock
      title={t("recurring_event")}
      description={withoutLinks(t("recurring_event_description"))}
      checked={form.recurringEvent !== null}
      onCheckedChange={(checked) => set("recurringEvent", checked ? DEFAULT_RULE : null)}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {t("repeats_every")}
        <Input
          type="number"
          min={1}
          max={100}
          className="w-16"
          aria-label={t("repeats_every")}
          value={rule.interval}
          onChange={(event) => update({ interval: whole(event.target.value, 1, 100) })}
        />
        <select
          className={selectClass}
          aria-label={`${t("repeats_every")} (${t("weekly", { count: 2 })})`}
          value={rule.freq}
          onChange={(event) => update({ freq: Number(event.target.value) as Rule["freq"] })}>
          {FREQUENCIES.map(({ freq, key }) => (
            <option key={freq} value={freq}>
              {t(key, { count: rule.interval })}
            </option>
          ))}
        </select>
        {t("for_a_maximum_of")}
        <Input
          type="number"
          min={1}
          max={100}
          className="w-16"
          aria-label={t("for_a_maximum_of")}
          value={rule.count}
          onChange={(event) => update({ count: whole(event.target.value, 1, 100) })}
        />
        {t("events").toLowerCase()}
      </div>
    </ToggleBlock>
  );
}

export const RECURRING_EDITOR_MESSAGE_KEYS = [
  "recurring_event",
  "recurring_event_description",
  "repeats_every",
  "weekly",
  "monthly",
  "yearly",
  "for_a_maximum_of",
  "events",
  "recurring_event_doesnt_support_booker_booking_limit",
];

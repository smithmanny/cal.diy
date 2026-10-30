import { Switch } from "@coss/ui/components/switch";
import type { TFunction } from "~/lib/i18n";
import type { TimeRange } from "~/lib/time-format";
import { RangesEditor } from "./RangesEditor";

const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export const WEEKLY_HOURS_MESSAGE_KEYS = [
  ...WEEKDAY_KEYS,
  "unavailable",
  "start_time",
  "end_time",
  "remove",
  "add_time_availability",
];

export function WeeklyHoursEditor({
  value,
  onChange,
  locale,
  t,
}: {
  value: TimeRange[][];
  onChange: (value: TimeRange[][]) => void;
  locale: string;
  t: TFunction;
}) {
  const setDay = (day: number, ranges: TimeRange[]) =>
    onChange(value.map((current, i) => (i === day ? ranges : current)));

  return (
    <ul className="divide-y">
      {WEEKDAY_KEYS.map((key, day) => {
        const ranges = value[day];
        const enabled = ranges.length > 0;
        return (
          <li key={key} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
            <label className="flex w-40 shrink-0 items-center gap-3 font-medium text-sm sm:pt-1">
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => setDay(day, checked ? [{ start: "09:00", end: "17:00" }] : [])}
              />
              {t(key)}
            </label>
            {enabled ? (
              <RangesEditor ranges={ranges} onChange={(next) => setDay(day, next)} locale={locale} t={t} />
            ) : (
              <span className="text-muted-foreground text-sm sm:pt-1.5">{t("unavailable")}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

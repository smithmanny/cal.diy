import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Switch } from "@coss/ui/components/switch";
import { TrashIcon } from "lucide-react";
import { useState } from "react";
import type { TFunction } from "~/lib/i18n";
import type { TimeRange } from "~/lib/time-format";
import { RangesEditor } from "./RangesEditor";

function formatDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`)
  );
}

export type DateOverride = { date: string; ranges: TimeRange[] };

export const DATE_OVERRIDES_MESSAGE_KEYS = [
  "date_overrides",
  "date_overrides_subtitle",
  "add_an_override",
  "date",
  "unavailable",
  "remove",
];

export function DateOverridesEditor({
  value,
  onChange,
  locale,
  t,
}: {
  value: DateOverride[];
  onChange: (value: DateOverride[]) => void;
  locale: string;
  t: TFunction;
}) {
  const [newDate, setNewDate] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  function add() {
    if (!newDate || value.some((override) => override.date === newDate)) return;
    onChange([...value, { date: newDate, ranges: [] }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate("");
  }

  const update = (date: string, ranges: TimeRange[]) =>
    onChange(value.map((override) => (override.date === date ? { ...override, ranges } : override)));

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">{t("date_overrides")}</h2>
        <p className="text-muted-foreground text-sm">{t("date_overrides_subtitle")}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {value.map((override) => (
          <li key={override.date} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{formatDate(override.date, locale)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("remove")}
                onClick={() => onChange(value.filter((o) => o.date !== override.date))}>
                <TrashIcon />
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={override.ranges.length === 0}
                onCheckedChange={(unavailable) =>
                  update(override.date, unavailable ? [] : [{ start: "09:00", end: "17:00" }])
                }
              />
              {t("unavailable")}
            </label>
            {override.ranges.length > 0 && (
              <RangesEditor
                ranges={override.ranges}
                onChange={(ranges) => update(override.date, ranges)}
                locale={locale}
                t={t}
              />
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label={t("date")}
          min={today}
          value={newDate}
          onChange={(event) => setNewDate(event.target.value)}
          className="w-auto"
        />
        <Button variant="outline" onClick={add} disabled={!newDate}>
          {t("add_an_override")}
        </Button>
      </div>
    </section>
  );
}

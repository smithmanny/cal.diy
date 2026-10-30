import { Button } from "@coss/ui/components/button";
import { PlusIcon, TrashIcon } from "lucide-react";
import type { TFunction } from "~/lib/i18n";
import type { TimeRange } from "~/lib/time-format";
import { TimeSelect } from "./TimeSelect";

/** Suggests the hour after the last range, so "add" doesn't create an overlap. */
function nextRange(ranges: TimeRange[]): TimeRange {
  const last = ranges.at(-1);
  if (!last) return { start: "09:00", end: "17:00" };
  const [hours] = last.end.split(":").map(Number);
  const start = Math.min(hours + 1, 22);
  return { start: `${String(start).padStart(2, "0")}:00`, end: `${String(start + 1).padStart(2, "0")}:00` };
}

export function RangesEditor({
  ranges,
  onChange,
  locale,
  t,
}: {
  ranges: TimeRange[];
  onChange: (ranges: TimeRange[]) => void;
  locale: string;
  t: TFunction;
}) {
  const update = (index: number, patch: Partial<TimeRange>) =>
    onChange(ranges.map((range, i) => (i === index ? { ...range, ...patch } : range)));

  return (
    <div className="flex flex-col gap-2">
      {ranges.map((range, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: ranges have no identity beyond their position
        <div key={index} className="flex items-center gap-2">
          <TimeSelect
            label={t("start_time")}
            value={range.start}
            locale={locale}
            onChange={(start) => update(index, { start })}
          />
          <span className="text-muted-foreground">-</span>
          <TimeSelect
            label={t("end_time")}
            value={range.end}
            locale={locale}
            onChange={(end) => update(index, { end })}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("remove")}
            onClick={() => onChange(ranges.filter((_, i) => i !== index))}>
            <TrashIcon />
          </Button>
          {index === ranges.length - 1 && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("add_time_availability")}
              onClick={() => onChange([...ranges, nextRange(ranges)])}>
              <PlusIcon />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

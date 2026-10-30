import { useHour12 } from "~/lib/hour-cycle";
import { formatTimeOfDay, TIME_OPTIONS } from "~/lib/time-format";

const selectClass =
  "h-9 rounded-lg border border-input bg-background px-2 text-sm shadow-xs/5 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8";

export function TimeSelect({
  value,
  onChange,
  locale,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  label: string;
}) {
  const hour12 = useHour12();
  const options = TIME_OPTIONS.includes(value) ? TIME_OPTIONS : [...TIME_OPTIONS, value].sort();
  return (
    <select
      aria-label={label}
      className={selectClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}>
      {options.map((time) => (
        <option key={time} value={time}>
          {formatTimeOfDay(time, locale, hour12)}
        </option>
      ))}
    </select>
  );
}

export { selectClass };

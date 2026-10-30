import type { TFunction } from "~/lib/i18n";

/** The booker's 12h/24h switch; the choice is remembered by the page (see useStoredHour12). */
export function HourCycleToggle({
  hour12,
  onChange,
  t,
}: {
  hour12: boolean;
  onChange: (hour12: boolean) => void;
  t: TFunction;
}) {
  return (
    <div role="group" aria-label={t("time_format")} className="flex rounded-md border p-0.5 text-xs">
      {[true, false].map((option) => (
        <button
          key={String(option)}
          type="button"
          aria-pressed={hour12 === option}
          onClick={() => onChange(option)}
          className={`rounded px-1.5 py-0.5 ${hour12 === option ? "bg-accent font-medium" : "text-muted-foreground"}`}>
          {option ? t("12_hour_short") : t("24_hour_short")}
        </button>
      ))}
    </div>
  );
}

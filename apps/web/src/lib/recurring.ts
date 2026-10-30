import type { TFunction } from "./i18n";

const FREQUENCY_KEYS: Record<number, string> = { 0: "yearly", 1: "monthly", 2: "weekly", 3: "daily" };

export const RECURRING_MESSAGE_KEYS = [
  "every_for_freq",
  "occurrence",
  "yearly",
  "monthly",
  "weekly",
  "daily",
];

/** Cal's getEveryFreqFor, e.g. "Every 2 weeks for 4 occurrences". */
export function recurringSummary(
  rule: { freq: number; interval: number; count: number },
  t: TFunction
): string {
  const unit = t(FREQUENCY_KEYS[rule.freq] ?? "weekly", { count: rule.interval });
  const freq = rule.interval > 1 ? `${rule.interval} ${unit}` : unit;
  return `${t("every_for_freq", { freq })} ${rule.count} ${t("occurrence", { count: rule.count })}`;
}

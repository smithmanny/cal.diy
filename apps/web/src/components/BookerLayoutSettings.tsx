import { selectClass } from "~/components/availability/TimeSelect";
import { BOOKER_LAYOUTS, type BookerLayouts, LAYOUT_LABEL_KEYS } from "~/lib/booker-layouts";
import type { TFunction } from "~/lib/i18n";

/** Cal's booking layout picker: which views bookers can switch between, and which comes first. */
export function BookerLayoutSettings({
  value,
  onChange,
  t,
}: {
  value: BookerLayouts;
  onChange: (layouts: BookerLayouts) => void;
  t: TFunction;
}) {
  function toggle(layout: BookerLayouts["defaultLayout"], on: boolean) {
    const enabledLayouts = BOOKER_LAYOUTS.filter((candidate) =>
      candidate === layout ? on : value.enabledLayouts.includes(candidate)
    );
    // Keep the default among the enabled views, as Cal requires.
    const defaultLayout = enabledLayouts.includes(value.defaultLayout)
      ? value.defaultLayout
      : (enabledLayouts[0] ?? value.defaultLayout);
    onChange({ enabledLayouts, defaultLayout });
  }
  return (
    <div className="flex flex-col gap-3 text-sm">
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1 text-muted-foreground">{t("bookerlayout_description")}</legend>
        {BOOKER_LAYOUTS.map((layout) => (
          <label key={layout} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.enabledLayouts.includes(layout)}
              onChange={(event) => toggle(layout, event.target.checked)}
            />
            {t(LAYOUT_LABEL_KEYS[layout])}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1.5 font-medium">
        {t("bookerlayout_default_title")}
        <select
          className={`${selectClass} max-w-xs`}
          value={value.defaultLayout}
          onChange={(event) =>
            onChange({ ...value, defaultLayout: event.target.value as BookerLayouts["defaultLayout"] })
          }>
          {value.enabledLayouts.map((layout) => (
            <option key={layout} value={layout}>
              {t(LAYOUT_LABEL_KEYS[layout])}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export const BOOKER_LAYOUT_MESSAGE_KEYS = [
  ...Object.values(LAYOUT_LABEL_KEYS),
  "bookerlayout_description",
  "bookerlayout_default_title",
  "bookerlayout_user_settings_title",
  "bookerlayout_user_settings_description",
  "bookerlayout_error_min_one_enabled",
  "bookerlayout_error_default_not_enabled",
];

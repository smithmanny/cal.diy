import { getHolidayEmoji } from "@calcom/lib/holidays/getHolidayEmoji";
import { Switch } from "@coss/ui/components/switch";
import { useRouter } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { useId } from "react";
import { selectClass } from "~/components/availability/TimeSelect";
import { useT } from "~/lib/i18n";
import { type getHolidaySettings, setHolidayCountry, toggleHoliday } from "~/server/holidays/functions";

type Settings = Extract<Awaited<ReturnType<typeof getHolidaySettings>>, { enabled: true }>;

function HolidayList({ settings, locale }: { settings: Settings; locale: string }) {
  const t = useT();
  const router = useRouter();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  if (!settings.countryCode) {
    return <p className="text-muted-foreground text-sm">{t("select_country_to_see_holidays")}</p>;
  }
  if (!settings.holidays.length) {
    return <p className="text-muted-foreground text-sm">{t("no_holidays_found_for_country")}</p>;
  }
  return (
    <ul className="flex flex-col divide-y rounded-lg border" data-testid="holidays">
      {settings.holidays.map((holiday) => (
        <li key={holiday.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
          <label className="flex flex-1 items-center justify-between gap-3">
            <span>
              <span aria-hidden>{getHolidayEmoji(holiday.name)} </span>
              <span className="font-medium">{holiday.name}</span>
              <span className="text-muted-foreground">
                {" "}
                · {dateFormat.format(new Date(`${holiday.date}T00:00:00Z`))}
              </span>
            </span>
            <Switch
              checked={holiday.enabled}
              onCheckedChange={async (enabled) => {
                await toggleHoliday({ data: { holidayId: holiday.id, enabled } });
                await router.invalidate();
              }}
            />
          </label>
        </li>
      ))}
    </ul>
  );
}

export const HOLIDAY_MESSAGE_KEYS = [
  "holidays",
  "holidays_description",
  "select_country",
  "select_country_to_see_holidays",
  "no_holidays_found_for_country",
  "holiday_booking_conflict_warning",
];

/** Country holidays the host takes off; each one can be switched back on individually. */
export function HolidaySettings({ settings, locale }: { settings: Settings; locale: string }) {
  const t = useT();
  const router = useRouter();
  const countryId = useId();
  const conflictCount = settings.conflicts.reduce((total, conflict) => total + conflict.bookings, 0);

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <div>
        <h2 className="font-heading text-lg">{t("holidays")}</h2>
        <p className="text-muted-foreground text-sm">{t("holidays_description")}</p>
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        <label htmlFor={countryId} className="font-medium">
          {t("select_country")}
        </label>
        <select
          id={countryId}
          className={selectClass}
          value={settings.countryCode ?? ""}
          onChange={async (event) => {
            await setHolidayCountry({ data: { countryCode: event.target.value || null } });
            await router.invalidate();
          }}>
          <option value="">-</option>
          {settings.countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </div>
      {conflictCount > 0 && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-warning/8 px-3 py-2 text-sm text-warning-foreground">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          {t("holiday_booking_conflict_warning", { count: conflictCount })}:{" "}
          {settings.conflicts.map((conflict) => conflict.holidayName).join(", ")}
        </p>
      )}
      <HolidayList settings={settings} locale={locale} />
    </section>
  );
}

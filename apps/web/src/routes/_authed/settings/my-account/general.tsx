import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Switch } from "@coss/ui/components/switch";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { TrashIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { selectClass } from "~/components/availability/TimeSelect";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { TimeZoneSelect } from "~/components/TimeZoneSelect";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { WEEK_DAY_NAMES, weekdayNames } from "~/lib/time-format";
import {
  addTravelSchedule,
  deleteTravelSchedule,
  getGeneralSettings,
  updateGeneralSettings,
} from "~/server/settings/functions";

const MESSAGE_KEYS = [
  "time_format",
  "12_hour",
  "24_hour",
  "timeformat_profile_hint",
  "start_of_week",
  "dynamic_booking",
  "allow_dynamic_booking",
  "seo_indexing",
  "allow_seo_indexing",
  "require_booker_email_verification",
  "require_booker_email_verification_description",
  "update",
  "settings_updated_successfully",
  "travel_schedule",
  "travel_schedule_description",
  "schedule_timezone_change",
  "schedule_tz_without_end_date",
  "timezone",
  "date",
  "until",
  "to",
  "add",
  "delete",
  "overlaps_with_existing_schedule",
  "start_date_must_be_before_end_date",
  "invalid_timezone",
  "something_went_wrong",
];

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 text-sm">
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function TravelSchedules({
  schedules,
}: {
  schedules: Awaited<ReturnType<typeof getGeneralSettings>>["travelSchedules"];
}) {
  const t = useT();
  const { locale, user } = Route.useRouteContext();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [timeZone, setTimeZone] = useState(user.timeZone);
  const [withEndDate, setWithEndDate] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const timeZoneId = useId();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);
    try {
      await addTravelSchedule({
        data: {
          timeZone,
          startDate: String(form.get("startDate")),
          endDate: withEndDate ? String(form.get("endDate")) : null,
        },
      });
      setAdding(false);
      await router.invalidate();
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <div>
        <h2 className="font-heading text-lg">{t("travel_schedule")}</h2>
        <p className="text-muted-foreground text-sm">{t("travel_schedule_description")}</p>
      </div>
      {schedules.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border" data-testid="travel-schedules">
          {schedules.map((schedule) => (
            <li key={schedule.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                {dateFormat.format(new Date(schedule.startDate))}
                {schedule.endDate
                  ? ` - ${dateFormat.format(new Date(schedule.endDate))}`
                  : ` ${t("until")} …`}
                <span className="text-muted-foreground"> · {schedule.timeZone}</span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("delete")}
                onClick={async () => {
                  await deleteTravelSchedule({ data: { id: schedule.id } });
                  await router.invalidate();
                }}>
                <TrashIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form method="post" onSubmit={onAdd} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1.5 font-medium text-sm">
              {t("date")}
              <Input type="date" name="startDate" required />
            </label>
            {withEndDate && (
              <label className="flex flex-col gap-1.5 font-medium text-sm">
                {t("to")}
                <Input type="date" name="endDate" required />
              </label>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!withEndDate} onCheckedChange={(checked) => setWithEndDate(!checked)} />
            {t("schedule_tz_without_end_date")}
          </label>
          <div className="flex flex-col gap-1.5 font-medium text-sm">
            <label htmlFor={timeZoneId}>{t("timezone")}</label>
            <TimeZoneSelect id={timeZoneId} value={timeZone} onChange={setTimeZone} />
          </div>
          <FormError message={errorKey && t(errorKey)} />
          <Button type="submit" className="self-start">
            {t("add")}
          </Button>
        </form>
      ) : (
        <Button variant="outline" className="self-start" onClick={() => setAdding(true)}>
          {t("schedule_timezone_change")}
        </Button>
      )}
    </section>
  );
}

function GeneralSettingsPage() {
  const { settings } = Route.useLoaderData();
  const { locale } = Route.useRouteContext();
  const t = useT();
  const router = useRouter();
  const [values, setValues] = useState({
    timeFormat: settings.timeFormat,
    weekStart: settings.weekStart,
    allowDynamicBooking: settings.allowDynamicBooking,
    allowSEOIndexing: settings.allowSEOIndexing,
    requiresBookerEmailVerification: settings.requiresBookerEmailVerification,
  });
  const [status, setStatus] = useState<{ kind: "error" | "saved"; key: string } | null>(null);
  const dayNames = weekdayNames(locale, "long");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    try {
      await updateGeneralSettings({
        data: {
          ...values,
          timeFormat: values.timeFormat === 24 ? 24 : 12,
          weekStart: values.weekStart as (typeof WEEK_DAY_NAMES)[number],
        },
      });
      // The session carries time format and week start, so every page picks them up.
      await router.invalidate();
      setStatus({ kind: "saved", key: "settings_updated_successfully" });
    } catch (error) {
      setStatus({ kind: "error", key: errorMessageKey(error) });
    }
  }

  return (
    <HydratedFieldset className="flex max-w-lg flex-col gap-8">
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("time_format")}
          <select
            className={selectClass}
            value={values.timeFormat}
            onChange={(event) =>
              setValues({ ...values, timeFormat: Number(event.target.value) === 24 ? 24 : 12 })
            }>
            <option value={12}>{t("12_hour")}</option>
            <option value={24}>{t("24_hour")}</option>
          </select>
          <span className="font-normal text-muted-foreground text-xs">{t("timeformat_profile_hint")}</span>
        </label>
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("start_of_week")}
          <select
            className={selectClass}
            value={values.weekStart}
            onChange={(event) => setValues({ ...values, weekStart: event.target.value })}>
            {WEEK_DAY_NAMES.map((name, index) => (
              <option key={name} value={name}>
                {dayNames[index]}
              </option>
            ))}
          </select>
        </label>
        <ToggleRow
          title={t("dynamic_booking")}
          description={t("allow_dynamic_booking")}
          checked={values.allowDynamicBooking}
          onChange={(checked) => setValues({ ...values, allowDynamicBooking: checked })}
        />
        <ToggleRow
          title={t("seo_indexing")}
          description={t("allow_seo_indexing")}
          checked={values.allowSEOIndexing}
          onChange={(checked) => setValues({ ...values, allowSEOIndexing: checked })}
        />
        <ToggleRow
          title={t("require_booker_email_verification")}
          description={t("require_booker_email_verification_description")}
          checked={values.requiresBookerEmailVerification}
          onChange={(checked) => setValues({ ...values, requiresBookerEmailVerification: checked })}
        />
        {status?.kind === "error" && <FormError message={t(status.key)} />}
        {status?.kind === "saved" && (
          <p role="status" className="text-sm text-success-foreground">
            {t(status.key)}
          </p>
        )}
        <Button type="submit" className="self-start">
          {t("update")}
        </Button>
      </form>
      <TravelSchedules schedules={settings.travelSchedules} />
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/my-account/general")({
  loader: async ({ context }) => {
    const [messages, settings] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getGeneralSettings(),
    ]);
    return { messages, settings };
  },
  component: GeneralSettingsPage,
});

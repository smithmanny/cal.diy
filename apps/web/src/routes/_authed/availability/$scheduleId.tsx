import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { useId, useState } from "react";
import { FormError } from "~/components/AuthCard";
import {
  DATE_OVERRIDES_MESSAGE_KEYS,
  DateOverridesEditor,
} from "~/components/availability/DateOverridesEditor";
import { WEEKLY_HOURS_MESSAGE_KEYS, WeeklyHoursEditor } from "~/components/availability/WeeklyHoursEditor";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { TimeZoneSelect } from "~/components/TimeZoneSelect";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import {
  deleteSchedule,
  getSchedule,
  setDefaultSchedule,
  updateSchedule,
} from "~/server/schedules/functions";

const MESSAGE_KEYS = [
  ...WEEKLY_HOURS_MESSAGE_KEYS,
  ...DATE_OVERRIDES_MESSAGE_KEYS,
  "availability",
  "name",
  "timezone",
  "save",
  "saved",
  "default",
  "set_to_default",
  "delete_schedule",
  "delete_schedule_description",
  "back",
  "something_went_wrong",
  "invalid_timezone",
  "overlapping_time_ranges",
  "error_end_time_before_start_time",
  "cannot_delete_default_schedule",
  "sunday_time_error",
  "monday_time_error",
  "tuesday_time_error",
  "wednesday_time_error",
  "thursday_time_error",
  "friday_time_error",
  "saturday_time_error",
];

function ScheduleEditorPage() {
  const { schedule } = Route.useLoaderData();
  const { locale } = Route.useRouteContext();
  const t = useT();
  const router = useRouter();
  const navigate = useNavigate();
  const nameId = useId();
  const timeZoneId = useId();
  const [name, setName] = useState(schedule.name);
  const [timeZone, setTimeZone] = useState(schedule.timeZone);
  const [weeklyHours, setWeeklyHours] = useState(schedule.weeklyHours);
  const [dateOverrides, setDateOverrides] = useState(schedule.dateOverrides);
  const [status, setStatus] = useState<{ kind: "error" | "saved"; key: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<unknown>, after?: () => Promise<unknown>) {
    setPending(true);
    setStatus(null);
    try {
      await action();
      await (after ? after() : router.invalidate());
      setStatus({ kind: "saved", key: "saved" });
    } catch (error) {
      setStatus({ kind: "error", key: errorMessageKey(error) });
    } finally {
      setPending(false);
    }
  }

  const save = () =>
    run(() =>
      updateSchedule({ data: { id: schedule.id, schedule: { name, timeZone, weeklyHours, dateOverrides } } })
    );

  return (
    <HydratedFieldset className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label={t("back")} render={<Link to="/availability" />}>
            <ArrowLeftIcon />
          </Button>
          <h1 className="font-heading text-2xl">{schedule.name}</h1>
          {schedule.isDefault && <Badge variant="secondary">{t("default")}</Badge>}
        </div>
        <div className="flex gap-2">
          {!schedule.isDefault && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => setDefaultSchedule({ data: { id: schedule.id } }))}>
              {t("set_to_default")}
            </Button>
          )}
          <Button disabled={pending} onClick={save}>
            {t("save")}
          </Button>
        </div>
      </div>
      {status &&
        (status.kind === "error" ? (
          <FormError message={t(status.key)} />
        ) : (
          <p role="status" className="text-sm text-success-foreground">
            {t(status.key)}
          </p>
        ))}

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border px-4">
            <WeeklyHoursEditor value={weeklyHours} onChange={setWeeklyHours} locale={locale} t={t} />
          </section>
          <section className="rounded-xl border p-4">
            <DateOverridesEditor value={dateOverrides} onChange={setDateOverrides} locale={locale} t={t} />
          </section>
        </div>
        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className="font-medium text-sm">
              {t("name")}
            </label>
            <Input
              id={nameId}
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={timeZoneId} className="font-medium text-sm">
              {t("timezone")}
            </label>
            <TimeZoneSelect id={timeZoneId} value={timeZone} onChange={setTimeZone} />
          </div>
          {!schedule.isDefault && (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-destructive/30 p-4">
              <p className="text-muted-foreground text-xs">{t("delete_schedule_description")}</p>
              <Button
                variant="destructive-outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () => deleteSchedule({ data: { id: schedule.id } }),
                    () => navigate({ to: "/availability" })
                  )
                }>
                {t("delete_schedule")}
              </Button>
            </div>
          )}
        </aside>
      </div>
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/availability/$scheduleId")({
  params: {
    parse: ({ scheduleId }) => {
      const id = Number(scheduleId);
      if (!Number.isInteger(id) || id <= 0) throw notFound();
      return { scheduleId: id };
    },
    stringify: ({ scheduleId }) => ({ scheduleId: String(scheduleId) }),
  },
  loader: async ({ context, params }) => {
    const [messages, schedule] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getSchedule({ data: { id: params.scheduleId } }),
    ]);
    return { messages, schedule };
  },
  component: ScheduleEditorPage,
});

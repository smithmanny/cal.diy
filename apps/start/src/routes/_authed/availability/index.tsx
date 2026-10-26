import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GlobeIcon, PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { PageHeader } from "~/components/AppShell";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { summarizeWeeklyHours } from "~/lib/time-format";
import { createSchedule, listSchedules } from "~/server/schedules/functions";

const MESSAGE_KEYS = [
  "availability",
  "configure_availability",
  "new_schedule_btn",
  "default",
  "name",
  "create",
  "cancel",
  "no_schedules_created_yet",
  "something_went_wrong",
];

const DEFAULT_WEEKLY_HOURS = [[], ...Array.from({ length: 5 }, () => [{ start: "09:00", end: "17:00" }]), []];

function NewScheduleForm({ timeZone, onCancel }: { timeZone: string; onCancel: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const { id } = await createSchedule({
        data: {
          name: String(new FormData(event.currentTarget).get("name")),
          timeZone,
          weeklyHours: DEFAULT_WEEKLY_HOURS,
          dateOverrides: [],
        },
      });
      await navigate({ to: "/availability/$scheduleId", params: { scheduleId: id } });
    } catch (error) {
      setErrorKey(errorMessageKey(error));
      setPending(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1.5 font-medium text-sm">
        {t("name")}
        <Input name="name" required maxLength={100} autoFocus />
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {t("create")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
      <FormError message={errorKey && t(errorKey)} />
    </form>
  );
}

function AvailabilityListPage() {
  const { schedules } = Route.useLoaderData();
  const { locale, user } = Route.useRouteContext();
  const t = useT();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title={t("availability")}
        description={t("configure_availability")}
        actions={
          <HydratedFieldset>
            <Button onClick={() => setCreating(true)}>
              <PlusIcon />
              {t("new_schedule_btn")}
            </Button>
          </HydratedFieldset>
        }
      />
      {creating && <NewScheduleForm timeZone={user.timeZone} onCancel={() => setCreating(false)} />}
      {schedules.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          {t("no_schedules_created_yet")}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {schedules.map((schedule) => (
            <li key={schedule.id}>
              <Link
                to="/availability/$scheduleId"
                params={{ scheduleId: schedule.id }}
                className="flex flex-col gap-1 p-4 transition-colors hover:bg-accent/50">
                <span className="flex items-center gap-2 font-medium">
                  {schedule.name}
                  {schedule.isDefault && <Badge variant="secondary">{t("default")}</Badge>}
                </span>
                {summarizeWeeklyHours(schedule.weeklyHours, locale, user.hour12).map((line) => (
                  <span key={line} className="text-muted-foreground text-sm">
                    {line}
                  </span>
                ))}
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <GlobeIcon className="size-3" />
                  {schedule.timeZone}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export const Route = createFileRoute("/_authed/availability/")({
  loader: async ({ context }) => {
    const [messages, schedules] = await Promise.all([loadMessages(context, MESSAGE_KEYS), listSchedules()]);
    return { messages, schedules };
  },
  component: AvailabilityListPage,
});

import slugify from "@calcom/lib/slugify";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Link, useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { selectClass } from "~/components/availability/TimeSelect";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { createTeamEventType, type listTeamEventTypes } from "~/server/event-types/functions";

type TeamGroup = Awaited<ReturnType<typeof listTeamEventTypes>>[number];
type SchedulingType = "COLLECTIVE" | "ROUND_ROBIN";

function NewTeamEventTypeForm({ teamId, onCancel }: { teamId: number; onCancel: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [length, setLength] = useState(30);
  const [schedulingType, setSchedulingType] = useState<SchedulingType>("COLLECTIVE");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const { id } = await createTeamEventType({
        data: { teamId, title, slug: slugify(title), length, description: null, schedulingType },
      });
      await navigate({ to: "/event-types/$eventTypeId", params: { eventTypeId: id } });
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-b p-4">
      <Input
        aria-label={t("title")}
        placeholder={t("title")}
        required
        maxLength={200}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-56"
      />
      <Input
        aria-label={`${t("duration")} (${t("minutes")})`}
        type="number"
        min={1}
        max={1440}
        value={length}
        onChange={(e) => setLength(Number(e.target.value))}
        className="w-24"
      />
      <select
        aria-label={t("scheduling_type")}
        className={selectClass}
        value={schedulingType}
        onChange={(event) =>
          setSchedulingType(event.target.value === "ROUND_ROBIN" ? "ROUND_ROBIN" : "COLLECTIVE")
        }>
        <option value="COLLECTIVE">{t("collective")}</option>
        <option value="ROUND_ROBIN">{t("round_robin")}</option>
      </select>
      <Button type="submit">{t("create")}</Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        {t("cancel")}
      </Button>
      <FormError message={errorKey && t(errorKey)} />
    </form>
  );
}

function TeamGroupSection({ group }: { group: TeamGroup }) {
  const t = useT();
  const [creating, setCreating] = useState(false);
  return (
    <section className="flex flex-col gap-2" aria-label={group.team.name}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{group.team.name}</h2>
        {group.canManage && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <PlusIcon />
            {t("new_team_event_type")}
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border">
        {creating && <NewTeamEventTypeForm teamId={group.team.id} onCancel={() => setCreating(false)} />}
        {group.eventTypes.length === 0 && !creating ? (
          <p className="p-6 text-center text-muted-foreground text-sm">{t("no_event_types")}</p>
        ) : (
          <ul className="divide-y">
            {group.eventTypes.map((eventType) => (
              <li key={eventType.id} className="flex items-center gap-3 p-4">
                {group.canManage ? (
                  <Link
                    to="/event-types/$eventTypeId"
                    params={{ eventTypeId: eventType.id }}
                    className="flex-1 font-medium hover:underline">
                    {eventType.title}
                  </Link>
                ) : (
                  <span className="flex-1 font-medium">{eventType.title}</span>
                )}
                <span className="text-muted-foreground text-xs">
                  /team/{group.team.slug}/{eventType.slug}
                </span>
                <Badge variant="secondary">
                  {t(eventType.schedulingType === "ROUND_ROBIN" ? "round_robin" : "collective")}
                </Badge>
                <Badge variant="outline">
                  {eventType.length} {t("minutes")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** The event types of each team the user is on, below their own. */
export function TeamEventTypes({ groups }: { groups: TeamGroup[] }) {
  if (!groups.length) return null;
  return (
    <div className="mt-8 flex flex-col gap-8">
      {groups.map((group) => (
        <TeamGroupSection key={group.team.id} group={group} />
      ))}
    </div>
  );
}

export const TEAM_EVENT_TYPES_MESSAGE_KEYS = [
  "new_team_event_type",
  "scheduling_type",
  "collective",
  "round_robin",
  "title",
  "duration",
  "minutes",
  "create",
  "cancel",
  "no_event_types",
];

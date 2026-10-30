import { Button } from "@coss/ui/components/button";
import { Checkbox } from "@coss/ui/components/checkbox";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { FormError } from "~/components/AuthCard";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { type getEventTypeAssignment, updateEventTypeAssignment } from "~/server/event-types/functions";
import { ToggleBlock } from "./EditorLayout";

type Assignment = NonNullable<Awaited<ReturnType<typeof getEventTypeAssignment>>>;

function HostList({
  members,
  hosts,
  roundRobin,
  onChange,
}: {
  members: Assignment["members"];
  hosts: Assignment["hosts"];
  roundRobin: boolean;
  onChange: (hosts: Assignment["hosts"]) => void;
}) {
  const t = useT();
  const byId = new Map(hosts.map((entry) => [entry.userId, entry]));
  const toggle = (userId: number, on: boolean) =>
    onChange(on ? [...hosts, { userId, isFixed: false }] : hosts.filter((entry) => entry.userId !== userId));
  const setFixed = (userId: number, isFixed: boolean) =>
    onChange(hosts.map((entry) => (entry.userId === userId ? { ...entry, isFixed } : entry)));
  return (
    <ul className="flex flex-col gap-2">
      {members.map((member) => {
        const label = member.name || member.email;
        const chosen = byId.get(member.userId);
        return (
          <li key={member.userId} className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={Boolean(chosen)}
                onCheckedChange={(on) => toggle(member.userId, on === true)}
              />
              {label}
            </label>
            {roundRobin && chosen && (
              <label className="flex items-center gap-2 text-muted-foreground">
                <Checkbox
                  aria-label={`${t("fixed_host")}: ${label}`}
                  checked={chosen.isFixed}
                  onCheckedChange={(on) => setFixed(member.userId, on === true)}
                />
                {t("fixed_host")}
              </label>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Cal's assignment tab for team event types: collective or round robin, and the hosts. */
export function AssignmentEditor({
  eventTypeId,
  assignment,
}: {
  eventTypeId: number;
  assignment: Assignment;
}) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState(assignment);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const roundRobin = state.schedulingType === "ROUND_ROBIN";
  async function save() {
    setErrorKey(null);
    setSaved(false);
    try {
      const { schedulingType, assignAllTeamMembers, hosts } = state;
      await updateEventTypeAssignment({
        data: { id: eventTypeId, assignment: { schedulingType, assignAllTeamMembers, hosts } },
      });
      await router.invalidate();
      setSaved(true);
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">{t("scheduling_type")}</legend>
        {(["COLLECTIVE", "ROUND_ROBIN"] as const).map((type) => (
          <label key={type} className="flex items-start gap-2">
            <input
              type="radio"
              name="schedulingType"
              checked={state.schedulingType === type}
              onChange={() => setState({ ...state, schedulingType: type })}
            />
            <span className="flex flex-col">
              <span className="font-medium">{t(type === "COLLECTIVE" ? "collective" : "round_robin")}</span>
              <span className="text-muted-foreground">
                {t(type === "COLLECTIVE" ? "collective_description" : "round_robin_description")}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <ToggleBlock
        title={t("assign_all_team_members")}
        checked={state.assignAllTeamMembers}
        onCheckedChange={(assignAllTeamMembers) => setState({ ...state, assignAllTeamMembers })}
      />
      {!state.assignAllTeamMembers && (
        <HostList
          members={state.members}
          hosts={state.hosts}
          roundRobin={roundRobin}
          onChange={(hosts) => setState({ ...state, hosts })}
        />
      )}
      <FormError message={errorKey && t(errorKey)} />
      <div className="flex items-center gap-3">
        <Button onClick={save}>{t("save")}</Button>
        {saved && (
          <span role="status" className="text-muted-foreground text-sm">
            {t("saved")}
          </span>
        )}
      </div>
    </div>
  );
}

export const ASSIGNMENT_MESSAGE_KEYS = [
  "assignment",
  "scheduling_type",
  "collective",
  "collective_description",
  "round_robin",
  "round_robin_description",
  "assign_all_team_members",
  "fixed_host",
  "no_available_users_found_error",
];

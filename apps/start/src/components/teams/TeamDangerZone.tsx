import { Button } from "@coss/ui/components/button";
import { useNavigate } from "@tanstack/react-router";
import { FormError } from "~/components/AuthCard";
import { useT } from "~/lib/i18n";
import { deleteTeam, leaveTeam } from "~/server/teams/functions";
import { useTeamAction } from "./useTeamAction";

/** Owners delete the team; everyone else may leave it. */
export function TeamDangerZone({ teamId, isOwner }: { teamId: number; isOwner: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const { run, errorKey } = useTeamAction();
  async function act(confirmKey: string, action: () => Promise<unknown>) {
    if (!window.confirm(t(confirmKey))) return;
    if (await run(action)) await navigate({ to: "/teams" });
  }
  return (
    <section className="flex flex-col gap-2">
      <FormError message={errorKey && t(errorKey)} />
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => act("leave_team_confirmation_message", () => leaveTeam({ data: { teamId } }))}>
          {t("leave_team")}
        </Button>
        {isOwner && (
          <Button
            variant="destructive"
            onClick={() => act("delete_team_confirmation", () => deleteTeam({ data: { teamId } }))}>
            {t("delete_team")}
          </Button>
        )}
      </div>
    </section>
  );
}

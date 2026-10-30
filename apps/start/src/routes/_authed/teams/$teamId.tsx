import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "~/components/AppShell";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { TEAM_FORM_MESSAGE_KEYS } from "~/components/teams/messages";
import { TeamDangerZone } from "~/components/teams/TeamDangerZone";
import { TEAM_MEMBERS_MESSAGE_KEYS, TeamMembers } from "~/components/teams/TeamMembers";
import { TeamProfileForm } from "~/components/teams/TeamProfileForm";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { getTeam } from "~/server/teams/functions";

const MESSAGE_KEYS = [
  ...TEAM_FORM_MESSAGE_KEYS,
  ...TEAM_MEMBERS_MESSAGE_KEYS,
  "about",
  "team_description",
  "save_changes",
  "team_updated_successfully",
  "organization",
  "teams_in_organization",
  "new_team",
  "part_of_organization",
  "leave_team",
  "leave_team_confirmation_message",
  "delete_team",
  "delete_team_confirmation",
];

function SubTeams({
  organizationId,
  teams,
  canAdd,
}: {
  organizationId: number;
  teams: { id: number; name: string }[];
  canAdd: boolean;
}) {
  const t = useT();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("teams_in_organization")}</h2>
        {canAdd && (
          <Button
            size="sm"
            variant="outline"
            render={<Link to="/teams/new" search={{ parentId: organizationId }} />}>
            {t("new_team")}
          </Button>
        )}
      </div>
      <ul className="divide-y rounded-xl border">
        {teams.map((team) => (
          <li key={team.id} className="p-3 text-sm">
            <Link to="/teams/$teamId" params={{ teamId: team.id }} className="hover:underline">
              {team.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TeamPage() {
  const loaded = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const t = useT();
  const { team, role, parent } = loaded;
  const manager = role === "OWNER" || role === "ADMIN";
  return (
    <HydratedFieldset>
      <PageHeader
        title={team.name}
        description={parent ? t("part_of_organization", { name: parent.name }) : undefined}
        actions={team.isOrganization ? <Badge variant="outline">{t("organization")}</Badge> : undefined}
      />
      <div className="flex flex-col gap-10">
        <TeamProfileForm key={team.id} team={team} editable={manager} />
        {team.isOrganization && (
          <SubTeams organizationId={team.id} teams={loaded.subTeams} canAdd={manager} />
        )}
        <TeamMembers loaded={loaded} userId={user.id} />
        <TeamDangerZone teamId={team.id} isOwner={role === "OWNER"} />
      </div>
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/teams/$teamId")({
  params: {
    parse: ({ teamId }) => {
      const id = Number(teamId);
      if (!Number.isInteger(id) || id <= 0) throw notFound();
      return { teamId: id };
    },
    stringify: ({ teamId }) => ({ teamId: String(teamId) }),
  },
  loader: async ({ context, params }) => {
    const [messages, loaded] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getTeam({ data: { teamId: params.teamId } }),
    ]);
    return { messages, ...loaded };
  },
  component: TeamPage,
});

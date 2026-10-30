import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/components/AppShell";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { listTeams, respondToTeamInvitation } from "~/server/teams/functions";

const MESSAGE_KEYS = [
  "teams",
  "new_team",
  "no_teams",
  "create_first_team_and_invite_others",
  "pending_invites",
  "invited_by_x",
  "accept",
  "decline",
  "organization",
  "owner",
  "admin",
  "member",
  "team_member_count_one",
  "team_member_count_other",
  "verify_email_to_join_team",
  "invitation_not_found",
  "something_went_wrong",
];

type Loaded = Awaited<ReturnType<typeof listTeams>>;

function Invitations({ invitations }: { invitations: Loaded["invitations"] }) {
  const t = useT();
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  if (!invitations.length) return null;
  async function respond(invitationId: number, accept: boolean) {
    setErrorKey(null);
    try {
      await respondToTeamInvitation({ data: { invitationId, accept } });
      await router.invalidate();
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-semibold">{t("pending_invites")}</h2>
      <FormError message={errorKey && t(errorKey)} />
      <ul className="divide-y rounded-xl border">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex-1">
              <div className="font-medium">{invitation.teamName}</div>
              <div className="text-muted-foreground text-sm">
                {t("invited_by_x", { name: invitation.inviterName })} · {t(invitation.role.toLowerCase())}
              </div>
            </div>
            <Button size="sm" onClick={() => respond(invitation.id, true)}>
              {t("accept")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => respond(invitation.id, false)}>
              {t("decline")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TeamsPage() {
  const { teams, invitations } = Route.useLoaderData();
  const t = useT();
  return (
    <HydratedFieldset>
      <PageHeader
        title={t("teams")}
        actions={<Button render={<Link to="/teams/new" />}>{t("new_team")}</Button>}
      />
      <Invitations invitations={invitations} />
      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">{t("no_teams")}</p>
          <p className="text-muted-foreground text-sm">{t("create_first_team_and_invite_others")}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {teams.map((team) => (
            <li key={team.id} className="flex items-center gap-3 p-4">
              <div className="flex-1">
                <Link
                  to="/teams/$teamId"
                  params={{ teamId: team.id }}
                  className="font-medium hover:underline">
                  {team.name}
                </Link>
                <div className="text-muted-foreground text-sm">
                  {team.slug && `/team/${team.slug} · `}
                  {t("team_member_count", { count: team.members })}
                </div>
              </div>
              {team.isOrganization && <Badge variant="outline">{t("organization")}</Badge>}
              <Badge variant="secondary">{t(team.role.toLowerCase())}</Badge>
            </li>
          ))}
        </ul>
      )}
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/teams/")({
  loader: async ({ context }) => {
    const [messages, loaded] = await Promise.all([loadMessages(context, MESSAGE_KEYS), listTeams()]);
    return { messages, ...loaded };
  },
  component: TeamsPage,
});

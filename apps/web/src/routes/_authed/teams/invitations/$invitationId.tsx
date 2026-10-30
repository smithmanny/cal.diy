import { Button } from "@coss/ui/components/button";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/components/AppShell";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { getTeamInvitation, respondToTeamInvitation } from "~/server/teams/functions";

const MESSAGE_KEYS = [
  "team_invite_received",
  "invited_by_x",
  "accept_invitation",
  "decline",
  "verify_email_to_join_team",
  "invitation_not_found",
  "something_went_wrong",
];

/** Where the invitation email leads; the invitee signs in first (the _authed layout sends them). */
function InvitationPage() {
  const { invitation } = Route.useLoaderData();
  const t = useT();
  const navigate = useNavigate();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  async function respond(accept: boolean) {
    setErrorKey(null);
    try {
      await respondToTeamInvitation({ data: { invitationId: invitation.id, accept } });
      await navigate(
        accept ? { to: "/teams/$teamId", params: { teamId: invitation.teamId } } : { to: "/teams" }
      );
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }
  return (
    <HydratedFieldset>
      <PageHeader
        title={t("team_invite_received", { teamName: invitation.teamName })}
        description={t("invited_by_x", { name: invitation.inviterName })}
      />
      <FormError message={errorKey && t(errorKey)} />
      <div className="flex gap-2">
        <Button onClick={() => respond(true)}>{t("accept_invitation")}</Button>
        <Button variant="outline" onClick={() => respond(false)}>
          {t("decline")}
        </Button>
      </div>
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/teams/invitations/$invitationId")({
  params: {
    parse: ({ invitationId }) => {
      const id = Number(invitationId);
      if (!Number.isInteger(id) || id <= 0) throw notFound();
      return { invitationId: id };
    },
    stringify: ({ invitationId }) => ({ invitationId: String(invitationId) }),
  },
  loader: async ({ context, params }) => {
    const [messages, invitation] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getTeamInvitation({ data: { invitationId: params.invitationId } }),
    ]);
    return { messages, invitation };
  },
  component: InvitationPage,
});

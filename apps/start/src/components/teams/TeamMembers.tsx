import { Button } from "@coss/ui/components/button";
import { type FormEvent, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { selectClass } from "~/components/availability/TimeSelect";
import { TextField } from "~/components/TextField";
import { useT } from "~/lib/i18n";
import type { getTeam } from "~/server/teams/functions";
import {
  cancelTeamInvitation,
  inviteTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
} from "~/server/teams/functions";
import { useTeamAction } from "./useTeamAction";

type Loaded = Awaited<ReturnType<typeof getTeam>>;
type Role = Loaded["role"];

const ROLES: Role[] = ["MEMBER", "ADMIN", "OWNER"];

function RoleSelect({
  value,
  label,
  onChange,
}: {
  value: Role;
  label: string;
  onChange: (role: Role) => void;
}) {
  const t = useT();
  return (
    <select
      aria-label={label}
      className={selectClass}
      value={value}
      onChange={(event) => onChange(ROLES.find((role) => role === event.target.value) ?? "MEMBER")}>
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {t(role.toLowerCase())}
        </option>
      ))}
    </select>
  );
}

function InviteForm({ teamId, run }: { teamId: number; run: ReturnType<typeof useTeamAction>["run"] }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const done = await run(() => inviteTeamMember({ data: { teamId, email, role } }));
    setSent(done);
    if (done) setEmail("");
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="w-72">
        <TextField
          label={t("invitee_email")}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <RoleSelect value={role} label={t("role")} onChange={setRole} />
      <Button type="submit">{t("invite")}</Button>
      {sent && (
        <span role="status" className="text-muted-foreground text-sm">
          {t("invitation_sent")}
        </span>
      )}
    </form>
  );
}

export function TeamMembers({ loaded, userId }: { loaded: Loaded; userId: number }) {
  const t = useT();
  const { run, errorKey } = useTeamAction();
  const teamId = loaded.team.id;
  const manager = loaded.role === "OWNER" || loaded.role === "ADMIN";
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold">{t("team_members")}</h2>
      <FormError message={errorKey && t(errorKey)} />
      {manager && <InviteForm teamId={teamId} run={run} />}
      <ul className="divide-y rounded-xl border">
        {loaded.members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{member.name || member.email}</div>
              <div className="text-muted-foreground">{member.email}</div>
            </div>
            {manager && member.userId !== userId ? (
              <>
                <RoleSelect
                  value={member.role}
                  label={`${t("role")}: ${member.email}`}
                  onChange={(role) =>
                    run(() => updateTeamMemberRole({ data: { teamId, memberId: member.id, role } }))
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${t("remove_member")}: ${member.email}`}
                  onClick={() => run(() => removeTeamMember({ data: { teamId, memberId: member.id } }))}>
                  {t("remove_member")}
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground">{t(member.role.toLowerCase())}</span>
            )}
          </li>
        ))}
      </ul>
      {loaded.invitations.length > 0 && (
        <>
          <h3 className="font-medium text-sm">{t("pending_invites")}</h3>
          <ul className="divide-y rounded-xl border">
            {loaded.invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="flex-1">{invitation.email}</span>
                <span className="text-muted-foreground">{t(invitation.role.toLowerCase())}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => run(() => cancelTeamInvitation({ data: { invitationId: invitation.id } }))}>
                  {t("cancel_invitation")}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export const TEAM_MEMBERS_MESSAGE_KEYS = [
  "team_members",
  "invitee_email",
  "role",
  "invite",
  "invitation_sent",
  "remove_member",
  "pending_invites",
  "cancel_invitation",
  "owner",
  "admin",
  "member",
  "already_a_member",
  "member_already_invited",
  "team_needs_an_owner",
];

import "@tanstack/react-start/server-only";
import { createAccessControl } from "better-auth/plugins/access";
import { organization } from "better-auth/plugins/organization";
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { AuthEmailSender } from "./createAuth";

/**
 * Cal's Team table as Better Auth's organization model sees it. Better Auth writes `metadata`
 * already JSON-encoded, so here it is plain text; Cal's schema reads the same column as JSON.
 */
const authTeam = sqliteTable("Team", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug"),
  logoUrl: text("logoUrl"),
  metadata: text("metadata"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  bio: text("bio"),
  parentId: integer("parentId"),
  isOrganization: integer("isOrganization", { mode: "boolean" }).notNull().default(false),
  timeZone: text("timeZone").notNull().default("Europe/London"),
});

const accessControl = createAccessControl(defaultStatements);

/** Cal's membership roles, with Better Auth's default permissions for owner, admin and member. */
const ROLES = {
  OWNER: accessControl.newRole(ownerAc.statements),
  ADMIN: accessControl.newRole(adminAc.statements),
  MEMBER: accessControl.newRole(memberAc.statements),
};

/** Invitations last a week, as Cal's team invite tokens did. */
const INVITATION_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;

/**
 * Teams and organizations are both Cal Teams (an organization has `isOrganization`, and its teams
 * point at it through `parentId`), each one a Better Auth organization with Cal's Membership rows.
 */
export function teamsPlugin(sendAuthEmail: AuthEmailSender | null, baseURL: string) {
  return organization({
    ac: accessControl,
    roles: ROLES,
    creatorRole: "OWNER",
    invitationExpiresIn: INVITATION_EXPIRES_IN_SECONDS,
    schema: {
      organization: {
        modelName: "team",
        fields: { logo: "logoUrl" },
        additionalFields: {
          bio: { type: "string", required: false, input: true },
          parentId: { type: "number", required: false, input: true },
          isOrganization: { type: "boolean", required: false, input: true, defaultValue: false },
          timeZone: { type: "string", required: false, input: true },
        },
      },
      member: {
        modelName: "membership",
        fields: { organizationId: "teamId" },
        // Cal's pending invites were unaccepted memberships; Better Auth only adds members who accepted.
        additionalFields: {
          accepted: { type: "boolean", required: false, input: false, defaultValue: true },
        },
      },
      invitation: { modelName: "teamInvitation", fields: { organizationId: "teamId" } },
      session: { fields: { activeOrganizationId: "activeOrganizationId" } },
    },
    sendInvitationEmail: sendAuthEmail
      ? async ({ id, email, inviter, organization: invitedTo }) => {
          await sendAuthEmail(
            "team_invite",
            { email, name: null, locale: null },
            `${baseURL}/teams/invitations/${id}`,
            { inviter: inviter.user.name || inviter.user.email, team: invitedTo.name }
          );
        }
      : undefined,
  });
}

export const teamsAuthSchema = { team: authTeam };

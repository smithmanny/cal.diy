import "@tanstack/react-start/server-only";
import type { Database } from "@calcom/db/database";
import type { MembershipRole } from "@calcom/db/enums";
import { membership, team, teamInvitation, user } from "@calcom/db/schema";
import { and, asc, count, eq, gt, inArray, ne, sql } from "drizzle-orm";

const teamColumns = {
  id: team.id,
  name: team.name,
  slug: team.slug,
  bio: team.bio,
  logoUrl: team.logoUrl,
  isOrganization: team.isOrganization,
  parentId: team.parentId,
  timeZone: team.timeZone,
};

/** Cal's Team and Membership rows; writes go through Better Auth's organization plugin. */
export class TeamRepository {
  constructor(private readonly db: Database) {}

  /** The user's teams and organizations with their role, alphabetically. */
  async findManyForUser(userId: number) {
    const memberCount = this.db
      .select({ teamId: membership.teamId, total: count().as("total") })
      .from(membership)
      .where(eq(membership.accepted, true))
      .groupBy(membership.teamId)
      .as("member_count");
    return this.db
      .select({
        ...teamColumns,
        role: membership.role,
        members: sql<number>`coalesce(${memberCount.total}, 0)`,
      })
      .from(membership)
      .innerJoin(team, eq(team.id, membership.teamId))
      .leftJoin(memberCount, eq(memberCount.teamId, team.id))
      .where(and(eq(membership.userId, userId), eq(membership.accepted, true)))
      .orderBy(asc(team.name));
  }

  async findById(teamId: number) {
    const [found] = await this.db.select(teamColumns).from(team).where(eq(team.id, teamId)).limit(1);
    return found ?? null;
  }

  async findBySlug(slug: string) {
    const [found] = await this.db.select(teamColumns).from(team).where(eq(team.slug, slug)).limit(1);
    return found ?? null;
  }

  async findRole(teamId: number, userId: number): Promise<MembershipRole | null> {
    const [found] = await this.db
      .select({ role: membership.role })
      .from(membership)
      .where(and(eq(membership.teamId, teamId), eq(membership.userId, userId), eq(membership.accepted, true)))
      .limit(1);
    return found?.role ?? null;
  }

  findMembers(teamId: number) {
    return this.db
      .select({
        id: membership.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: membership.role,
      })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(and(eq(membership.teamId, teamId), eq(membership.accepted, true)))
      .orderBy(asc(user.name), asc(user.email));
  }

  /** People who share at least one team with the user, without the user. */
  async findTeammates(userId: number) {
    const mine = this.db
      .select({ teamId: membership.teamId })
      .from(membership)
      .where(and(eq(membership.userId, userId), eq(membership.accepted, true)));
    return this.db
      .selectDistinct({ id: user.id, name: user.name, email: user.email, username: user.username })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(and(inArray(membership.teamId, mine), eq(membership.accepted, true), ne(user.id, userId)))
      .orderBy(asc(user.name), asc(user.email));
  }

  findSubTeams(organizationId: number) {
    return this.db
      .select(teamColumns)
      .from(team)
      .where(eq(team.parentId, organizationId))
      .orderBy(asc(team.name));
  }

  findPendingInvitations(teamId: number, now: Date) {
    return this.db
      .select({
        id: teamInvitation.id,
        email: teamInvitation.email,
        role: teamInvitation.role,
        expiresAt: teamInvitation.expiresAt,
      })
      .from(teamInvitation)
      .where(
        and(
          eq(teamInvitation.teamId, teamId),
          eq(teamInvitation.status, "pending"),
          gt(teamInvitation.expiresAt, now)
        )
      )
      .orderBy(asc(teamInvitation.email));
  }

  /** Invitations waiting for this email, with the team and who sent them. */
  findPendingInvitationsForEmail(email: string, now: Date) {
    return this.db
      .select({
        id: teamInvitation.id,
        role: teamInvitation.role,
        teamId: team.id,
        teamName: team.name,
        isOrganization: team.isOrganization,
        inviterName: sql<string>`coalesce(${user.name}, ${user.email})`,
      })
      .from(teamInvitation)
      .innerJoin(team, eq(team.id, teamInvitation.teamId))
      .innerJoin(user, eq(user.id, teamInvitation.inviterId))
      .where(
        and(
          eq(teamInvitation.email, email.toLowerCase()),
          eq(teamInvitation.status, "pending"),
          gt(teamInvitation.expiresAt, now)
        )
      )
      .orderBy(asc(team.name));
  }
}

import "@tanstack/react-start/server-only";
import type { MembershipRole } from "@calcom/db/enums";
import { AppError } from "../errors";
import type { TeamRepository } from "./TeamRepository";

type Deps = { teamRepo: TeamRepository; now?: () => Date };

const MANAGERS: ReadonlySet<MembershipRole> = new Set(["OWNER", "ADMIN"]);

export function canManage(role: MembershipRole | null): boolean {
  return role !== null && MANAGERS.has(role);
}

/** Reading teams and checking who may change them; Better Auth performs the writes. */
export class TeamService {
  constructor(private readonly deps: Deps) {}

  async list(userId: number, email: string) {
    const [teams, invitations] = await Promise.all([
      this.deps.teamRepo.findManyForUser(userId),
      this.deps.teamRepo.findPendingInvitationsForEmail(email, this.now()),
    ]);
    return { teams, invitations };
  }

  /** A team's settings for one of its members; invitations only for those who manage it. */
  async get(userId: number, teamId: number) {
    const role = await this.deps.teamRepo.findRole(teamId, userId);
    const found = role && (await this.deps.teamRepo.findById(teamId));
    if (!role || !found) throw new AppError("team_not_found", 404);
    const manager = canManage(role);
    const [members, invitations, subTeams, parent] = await Promise.all([
      this.deps.teamRepo.findMembers(teamId),
      manager ? this.deps.teamRepo.findPendingInvitations(teamId, this.now()) : [],
      found.isOrganization ? this.deps.teamRepo.findSubTeams(teamId) : [],
      found.parentId ? this.deps.teamRepo.findById(found.parentId) : null,
    ]);
    return {
      team: found,
      role,
      members,
      invitations: invitations.map((invitation) => ({
        ...invitation,
        expiresAt: invitation.expiresAt.toISOString(),
      })),
      subTeams,
      parent: parent && { id: parent.id, name: parent.name },
    };
  }

  /** Teams inside an organization are created by those who manage it. */
  async assertCanCreateIn(userId: number, organizationId: number): Promise<void> {
    const parent = await this.deps.teamRepo.findById(organizationId);
    if (!parent?.isOrganization) throw new AppError("team_not_found", 404);
    if (!canManage(await this.deps.teamRepo.findRole(organizationId, userId)))
      throw new AppError("unauthorized", 403);
  }

  async invitationFor(email: string, invitationId: number) {
    const pending = await this.deps.teamRepo.findPendingInvitationsForEmail(email, this.now());
    const found = pending.find((invitation) => invitation.id === invitationId);
    if (!found) throw new AppError("invitation_not_found", 404);
    return found;
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }
}

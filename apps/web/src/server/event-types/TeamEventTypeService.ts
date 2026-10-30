import "@tanstack/react-start/server-only";
import slugify from "@calcom/lib/slugify";
import { AppError } from "../errors";
import type { TeamRepository } from "../teams/TeamRepository";
import { canManage } from "../teams/TeamService";
import type { EventTypeRepository } from "./EventTypeRepository";
import type { TeamAssignmentInput, TeamEventTypeInput } from "./types";

type Deps = {
  eventTypeRepo: Pick<
    EventTypeRepository,
    | "findById"
    | "findManyByTeamId"
    | "slugExistsForTeam"
    | "createForTeam"
    | "findHosts"
    | "setHosts"
    | "update"
  >;
  teamRepo: Pick<TeamRepository, "findManyForUser" | "findRole" | "findMembers">;
};

/** Event types that belong to a team: who may change them, and who takes their bookings. */
export class TeamEventTypeService {
  constructor(private readonly deps: Deps) {}

  /** Each team the user is on, with its event types and whether the user may change them. */
  async listForUser(userId: number) {
    const teams = await this.deps.teamRepo.findManyForUser(userId);
    return Promise.all(
      teams.map(async (team) => ({
        team: { id: team.id, name: team.name, slug: team.slug },
        canManage: canManage(team.role),
        eventTypes: await this.deps.eventTypeRepo.findManyByTeamId(team.id),
      }))
    );
  }

  async create(userId: number, input: TeamEventTypeInput): Promise<{ id: number }> {
    await this.assertManager(userId, input.teamId);
    const slug = slugify(input.slug || input.title);
    if (!slug || (await this.deps.eventTypeRepo.slugExistsForTeam(input.teamId, slug)))
      throw new AppError("url_taken", 409);
    // New team event types are booked with everyone on the team until the owner picks hosts.
    return this.deps.eventTypeRepo.createForTeam(input.teamId, {
      title: input.title,
      slug,
      description: input.description,
      length: input.length,
      schedulingType: input.schedulingType,
      assignAllTeamMembers: true,
    });
  }

  /** Null for a personal event type; otherwise its team, hosts, and the members to pick from. */
  async getAssignment(userId: number, id: number) {
    const found = await this.deps.eventTypeRepo.findById(id);
    if (!found?.teamId) return null;
    await this.assertManager(userId, found.teamId);
    const [hosts, members] = await Promise.all([
      this.deps.eventTypeRepo.findHosts(id),
      this.deps.teamRepo.findMembers(found.teamId),
    ]);
    const team = (await this.deps.teamRepo.findManyForUser(userId)).find(
      (entry) => entry.id === found.teamId
    );
    return {
      teamId: found.teamId,
      teamSlug: team?.slug ?? null,
      // Managed event types aren't supported; they're edited as collective ones.
      schedulingType:
        found.schedulingType === "ROUND_ROBIN" ? ("ROUND_ROBIN" as const) : ("COLLECTIVE" as const),
      assignAllTeamMembers: found.assignAllTeamMembers,
      hosts: hosts.map(({ userId: hostId, isFixed }) => ({ userId: hostId, isFixed })),
      members: members.map(({ userId: memberId, name, email }) => ({ userId: memberId, name, email })),
    };
  }

  async setAssignment(userId: number, id: number, input: TeamAssignmentInput): Promise<void> {
    const found = await this.deps.eventTypeRepo.findById(id);
    if (!found?.teamId) throw new AppError("not_found", 404);
    await this.assertManager(userId, found.teamId);
    const members = new Set(
      (await this.deps.teamRepo.findMembers(found.teamId)).map((member) => member.userId)
    );
    const hosts = input.assignAllTeamMembers ? [] : input.hosts.filter((entry) => members.has(entry.userId));
    if (!input.assignAllTeamMembers && !hosts.length) throw new AppError("no_available_users_found_error");
    await this.deps.eventTypeRepo.update(id, {
      schedulingType: input.schedulingType,
      assignAllTeamMembers: input.assignAllTeamMembers,
    });
    // Fixed hosts only mean something in round robin; collective hosts all attend anyway.
    await this.deps.eventTypeRepo.setHosts(
      id,
      hosts.map((entry) => ({
        userId: entry.userId,
        isFixed: input.schedulingType === "ROUND_ROBIN" && entry.isFixed,
      }))
    );
  }

  private async assertManager(userId: number, teamId: number): Promise<void> {
    if (!canManage(await this.deps.teamRepo.findRole(teamId, userId))) throw new AppError("not_found", 404);
  }
}

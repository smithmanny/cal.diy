import "@tanstack/react-start/server-only";
import { AppError } from "../errors";
import type { EventTypeRepository, EventTypeRow } from "../event-types/EventTypeRepository";
import type { TeamRepository } from "../teams/TeamRepository";
import type { UserRepository } from "../users/UserRepository";

type Host = Awaited<ReturnType<UserRepository["findHostsByIds"]>>[number];

type Deps = {
  teamRepo: Pick<TeamRepository, "findBySlug" | "findMembers">;
  eventTypeRepo: Pick<EventTypeRepository, "findByTeamIdAndSlug" | "findHosts">;
  userRepo: Pick<UserRepository, "findHostsByIds">;
};

export type TeamEvent = {
  team: { id: number; name: string; slug: string; logoUrl: string | null };
  eventType: EventTypeRow;
  /** Must all be free: every host of a collective event, the fixed hosts of a round robin one. */
  fixed: Host[];
  /** Round robin: the booking goes to one of these who is free. */
  roundRobin: Host[];
};

/** Resolves a team's event type to the people who take its bookings. */
export class TeamEventLoader {
  constructor(private readonly deps: Deps) {}

  async load(teamSlug: string, slug: string): Promise<TeamEvent> {
    const team = await this.deps.teamRepo.findBySlug(teamSlug);
    if (!team?.slug) throw new AppError("team_not_found", 404);
    const eventType = await this.deps.eventTypeRepo.findByTeamIdAndSlug(team.id, slug);
    if (!eventType) throw new AppError("event_type_not_found", 404);
    const assigned = await this.assignedHosts(team.id, eventType);
    const hosts = await this.deps.userRepo.findHostsByIds(assigned.map((entry) => entry.userId));
    const fixedIds = new Set(assigned.filter((entry) => entry.isFixed).map((entry) => entry.userId));
    const roundRobin = eventType.schedulingType === "ROUND_ROBIN";
    const fixed = roundRobin ? hosts.filter((entry) => fixedIds.has(entry.id)) : hosts;
    const candidates = roundRobin ? hosts.filter((entry) => !fixedIds.has(entry.id)) : [];
    if (!fixed.length && !candidates.length) throw new AppError("no_available_users_found_error", 404);
    return {
      team: { id: team.id, name: team.name, slug: team.slug, logoUrl: team.logoUrl },
      eventType,
      fixed,
      roundRobin: candidates,
    };
  }

  /** Cal's assignAllTeamMembers takes everyone on the team; otherwise the chosen hosts. */
  private async assignedHosts(teamId: number, eventType: EventTypeRow) {
    if (!eventType.assignAllTeamMembers) return this.deps.eventTypeRepo.findHosts(eventType.id);
    const members = await this.deps.teamRepo.findMembers(teamId);
    return members.map((member) => ({ userId: member.userId, isFixed: false }));
  }
}

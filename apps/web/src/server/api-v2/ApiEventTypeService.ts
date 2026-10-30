import "@tanstack/react-start/server-only";

import { AppError } from "../errors";
import type { EventTypeRepository } from "../event-types/EventTypeRepository";
import type { EventTypeService } from "../event-types/EventTypeService";
import { type EventTypeDto, type EventTypeInput, eventTypeInputSchema } from "../event-types/types";
import type { UserRepository } from "../users/UserRepository";
import type { ApiUserRepository, OwnerRow } from "./ApiUserRepository";
import type { ApiUser } from "./auth";
import { applyEventTypeInput, type EventTypeApiInput, toEventTypeOutput } from "./eventTypeMapper";
import { parseInput } from "./http";

type Deps = {
  eventTypes: EventTypeService;
  users: ApiUserRepository;
  userRepo: UserRepository;
  eventTypeRepo: Pick<EventTypeRepository, "findById">;
};

type EventTypeOutput = ReturnType<typeof toEventTypeOutput>;

function withoutId({ id: _id, ...input }: EventTypeDto): EventTypeInput {
  return input;
}

/** Cal's API v2 event type endpoints (version 2024-06-14), on the app's EventTypeService. */
class ApiEventTypeService {
  constructor(private readonly deps: Deps) {}

  /**
   * With `username`, that user's public event types (or the one named by `eventSlug`); otherwise
   * every event type of the API key's owner.
   */
  async list(
    actor: ApiUser | null,
    query: { username?: string; eventSlug?: string },
    origin: string
  ): Promise<EventTypeOutput[]> {
    if (!query.username && !actor) throw new AppError("unauthorized", 401);
    const ownerId = query.username
      ? (await this.deps.userRepo.findByUsername(query.username))?.id
      : actor?.id;
    if (ownerId === undefined) return [];
    const [owner, eventTypes] = await Promise.all([
      this.owner(ownerId),
      // Other people only see the event types listed on the booking page.
      this.deps.eventTypes.listWithDetails(ownerId, { visibleOnly: Boolean(query.username) }),
    ]);
    return eventTypes
      .filter((eventType) => !query.eventSlug || eventType.slug === query.eventSlug)
      .map((eventType) => toEventTypeOutput(eventType, owner, origin));
  }

  async get(actor: ApiUser, id: number, origin: string): Promise<EventTypeOutput> {
    await this.assertPersonal(id);
    const owner = await this.owner(actor.id);
    return toEventTypeOutput(await this.deps.eventTypes.get(actor.id, id, owner.timeZone), owner, origin);
  }

  /** Created with Cal's defaults, then given the other settings sent; all or nothing. */
  async create(actor: ApiUser, input: EventTypeApiInput, origin: string): Promise<EventTypeOutput> {
    const { id } = await this.deps.eventTypes.create(actor.id, {
      title: input.title ?? "",
      slug: input.slug ?? "",
      description: input.description ?? null,
      length: input.lengthInMinutes ?? 0,
    });
    try {
      return await this.update(actor, id, input, origin);
    } catch (error) {
      await this.deps.eventTypes.delete(actor.id, id);
      throw error;
    }
  }

  async update(
    actor: ApiUser,
    id: number,
    input: EventTypeApiInput,
    origin: string
  ): Promise<EventTypeOutput> {
    await this.assertPersonal(id);
    const owner = await this.owner(actor.id);
    const current = await this.deps.eventTypes.get(actor.id, id, owner.timeZone);
    const next = applyEventTypeInput(withoutId(current), input);
    await this.deps.eventTypes.update(actor.id, id, parseInput(eventTypeInputSchema, next), owner.timeZone);
    return this.get(actor, id, origin);
  }

  async delete(actor: ApiUser, id: number) {
    await this.assertPersonal(id);
    const current = await this.deps.eventTypes.get(actor.id, id);
    await this.deps.eventTypes.delete(actor.id, id);
    return { id, lengthInMinutes: current.length, title: current.title, slug: current.slug };
  }

  /**
   * These are the personal event type endpoints; a team's event types (Cal's
   * /teams/{teamId}/event-types) aren't served, rather than answered with the caller as owner.
   */
  private async assertPersonal(id: number): Promise<void> {
    if ((await this.deps.eventTypeRepo.findById(id))?.teamId) throw new AppError("event_type_not_found", 404);
  }

  private async owner(userId: number): Promise<OwnerRow> {
    const owner = await this.deps.users.findOwner(userId);
    if (!owner) throw new AppError("unauthorized", 401);
    return owner;
  }
}

export { ApiEventTypeService };

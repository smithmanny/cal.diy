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
  eventTypeRepo: EventTypeRepository;
  users: ApiUserRepository;
  userRepo: UserRepository;
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
    if (query.username) {
      const host = await this.deps.userRepo.findByUsername(query.username);
      if (!host) return [];
      const visible = await this.deps.eventTypeRepo.findManyVisibleByUserId(host.id);
      const ids = visible
        .filter((row) => !query.eventSlug || row.slug === query.eventSlug)
        .map((row) => row.id);
      return this.outputs(host.id, ids, origin);
    }
    if (!actor) throw new AppError("unauthorized", 401);
    const owned = await this.deps.eventTypes.list(actor.id);
    return this.outputs(
      actor.id,
      owned.map((row) => row.id),
      origin
    );
  }

  async get(actor: ApiUser, id: number, origin: string): Promise<EventTypeOutput> {
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
    const owner = await this.owner(actor.id);
    const current = await this.deps.eventTypes.get(actor.id, id, owner.timeZone);
    const next = applyEventTypeInput(withoutId(current), input);
    await this.deps.eventTypes.update(actor.id, id, parseInput(eventTypeInputSchema, next), owner.timeZone);
    return this.get(actor, id, origin);
  }

  async delete(actor: ApiUser, id: number) {
    const current = await this.deps.eventTypes.get(actor.id, id);
    await this.deps.eventTypes.delete(actor.id, id);
    return { id, lengthInMinutes: current.length, title: current.title, slug: current.slug };
  }

  private async outputs(ownerId: number, ids: number[], origin: string): Promise<EventTypeOutput[]> {
    const owner = await this.owner(ownerId);
    const dtos = await Promise.all(ids.map((id) => this.deps.eventTypes.get(ownerId, id, owner.timeZone)));
    return dtos.map((dto) => toEventTypeOutput(dto, owner, origin));
  }

  private async owner(userId: number): Promise<OwnerRow> {
    const owner = await this.deps.users.findOwner(userId);
    if (!owner) throw new AppError("unauthorized", 401);
    return owner;
  }
}

export { ApiEventTypeService };

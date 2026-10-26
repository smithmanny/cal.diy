import "@tanstack/react-start/server-only";

import slugify from "@calcom/lib/slugify";
import { AppError } from "../errors";
import type { ScheduleRepository } from "../schedules/ScheduleRepository";
import type { EventTypeRepository, EventTypeRow } from "./EventTypeRepository";
import {
  type EventLocation,
  type EventTypeDto,
  type EventTypeInput,
  type EventTypeSummaryDto,
  eventLocationSchema,
  type NewEventTypeInput,
} from "./types";

type Deps = {
  eventTypeRepo: EventTypeRepository;
  scheduleRepo: Pick<ScheduleRepository, "existsForUser">;
};

function parseLocations(value: unknown): EventLocation[] {
  if (!Array.isArray(value)) return [];
  // Rows written by older code may hold location types this app doesn't support yet; skip them.
  return value.flatMap((item) => {
    const parsed = eventLocationSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function toDto(row: EventTypeRow): EventTypeDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    length: row.length,
    hidden: row.hidden,
    scheduleId: row.scheduleId,
    locations: parseLocations(row.locations),
    minimumBookingNotice: row.minimumBookingNotice,
    beforeEventBuffer: row.beforeEventBuffer,
    afterEventBuffer: row.afterEventBuffer,
    slotInterval: row.slotInterval,
    periodType: row.periodType === "ROLLING" ? "ROLLING" : "UNLIMITED",
    periodDays: row.periodDays,
    periodCountCalendarDays: row.periodCountCalendarDays ?? true,
    requiresConfirmation: row.requiresConfirmation,
  };
}

export class EventTypeService {
  constructor(private readonly deps: Deps) {}

  list(userId: number): Promise<EventTypeSummaryDto[]> {
    return this.deps.eventTypeRepo.findManyByUserId(userId);
  }

  async get(userId: number, id: number): Promise<EventTypeDto> {
    return toDto(await this.findOwned(userId, id));
  }

  async create(userId: number, input: NewEventTypeInput): Promise<{ id: number }> {
    const slug = await this.assertSlugAvailable(userId, input.slug || input.title);
    const position = (await this.deps.eventTypeRepo.findMaxPositionForUser(userId)) + 1;
    return this.deps.eventTypeRepo.create(userId, {
      title: input.title,
      slug,
      description: input.description,
      length: input.length,
      position,
    });
  }

  /** Cal's onboarding gives every new user these two, so their booking page isn't empty. */
  async createDefaults(userId: number, titles: { fifteen: string; thirty: string }): Promise<void> {
    await this.deps.eventTypeRepo.createMany(userId, [
      { title: titles.thirty, slug: "30min", length: 30, position: 2 },
      { title: titles.fifteen, slug: "15min", length: 15, position: 1 },
    ]);
  }

  async update(userId: number, id: number, input: EventTypeInput): Promise<void> {
    await this.findOwned(userId, id);
    const slug = await this.assertSlugAvailable(userId, input.slug, id);
    if (
      input.scheduleId !== null &&
      !(await this.deps.scheduleRepo.existsForUser(input.scheduleId, userId))
    ) {
      throw new AppError("not_found", 404);
    }
    await this.deps.eventTypeRepo.update(id, {
      title: input.title,
      slug,
      description: input.description,
      length: input.length,
      hidden: input.hidden,
      scheduleId: input.scheduleId,
      locations: input.locations,
      minimumBookingNotice: input.minimumBookingNotice,
      beforeEventBuffer: input.beforeEventBuffer,
      afterEventBuffer: input.afterEventBuffer,
      slotInterval: input.slotInterval,
      periodType: input.periodType,
      periodDays: input.periodType === "ROLLING" ? input.periodDays : null,
      periodCountCalendarDays: input.periodCountCalendarDays,
      requiresConfirmation: input.requiresConfirmation,
    });
  }

  async setHidden(userId: number, id: number, hidden: boolean): Promise<void> {
    await this.findOwned(userId, id);
    await this.deps.eventTypeRepo.update(id, { hidden });
  }

  async delete(userId: number, id: number): Promise<void> {
    await this.findOwned(userId, id);
    await this.deps.eventTypeRepo.deleteById(id);
  }

  private async findOwned(userId: number, id: number): Promise<EventTypeRow> {
    const found = await this.deps.eventTypeRepo.findById(id);
    if (!found || found.userId !== userId) throw new AppError("not_found", 404);
    return found;
  }

  private async assertSlugAvailable(userId: number, raw: string, excludeId?: number): Promise<string> {
    const slug = slugify(raw);
    if (!slug) throw new AppError("url_taken");
    if (await this.deps.eventTypeRepo.slugExistsForUser(userId, slug, excludeId))
      throw new AppError("url_taken", 409);
    return slug;
  }
}

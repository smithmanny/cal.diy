import "@tanstack/react-start/server-only";

import { AppError } from "../errors";
import type { UserRepository } from "../users/UserRepository";
import type { ScheduleRepository, ScheduleWithAvailability } from "./ScheduleRepository";
import {
  DEFAULT_WEEKLY_HOURS,
  fromAvailabilityRows,
  toAvailabilityRows,
  validateSchedule,
} from "./scheduleMapper";
import type { ScheduleDto, ScheduleInput, ScheduleSummaryDto } from "./types";

type Deps = {
  scheduleRepo: ScheduleRepository;
  userRepo: Pick<UserRepository, "findDefaultScheduleId" | "updateDefaultScheduleId">;
};

export class ScheduleService {
  constructor(private readonly deps: Deps) {}

  async list(userId: number, fallbackTimeZone: string): Promise<ScheduleSummaryDto[]> {
    const [schedules, defaultId] = await Promise.all([
      this.deps.scheduleRepo.findManyByUserIdIncludeAvailability(userId),
      this.deps.userRepo.findDefaultScheduleId(userId),
    ]);
    const effectiveDefaultId = defaultId ?? schedules[0]?.id;
    return schedules.map((s) => ({
      id: s.id,
      name: s.name,
      timeZone: s.timeZone ?? fallbackTimeZone,
      isDefault: s.id === effectiveDefaultId,
      weeklyHours: fromAvailabilityRows(s.availability).weeklyHours,
    }));
  }

  async get(userId: number, id: number, fallbackTimeZone: string): Promise<ScheduleDto> {
    const found = await this.findOwned(userId, id);
    const defaultId = await this.deps.userRepo.findDefaultScheduleId(userId);
    return {
      id: found.id,
      name: found.name,
      timeZone: found.timeZone ?? fallbackTimeZone,
      isDefault: found.id === defaultId,
      ...fromAvailabilityRows(found.availability),
    };
  }

  async create(userId: number, input: ScheduleInput): Promise<{ id: number }> {
    this.assertValid(input);
    const created = await this.deps.scheduleRepo.create({
      userId,
      name: input.name,
      timeZone: input.timeZone,
      availability: toAvailabilityRows(input),
    });
    // The first schedule a user creates becomes their default, so event types always have one.
    if ((await this.deps.userRepo.findDefaultScheduleId(userId)) === null) {
      await this.deps.userRepo.updateDefaultScheduleId(userId, created.id);
    }
    return created;
  }

  createDefault(userId: number, timeZone: string, name: string) {
    return this.create(userId, { name, timeZone, weeklyHours: DEFAULT_WEEKLY_HOURS, dateOverrides: [] });
  }

  async update(userId: number, id: number, input: ScheduleInput): Promise<void> {
    this.assertValid(input);
    await this.findOwned(userId, id);
    await this.deps.scheduleRepo.replace({
      id,
      userId,
      name: input.name,
      timeZone: input.timeZone,
      availability: toAvailabilityRows(input),
    });
  }

  async setDefault(userId: number, id: number): Promise<void> {
    await this.findOwned(userId, id);
    await this.deps.userRepo.updateDefaultScheduleId(userId, id);
  }

  async delete(userId: number, id: number): Promise<void> {
    await this.findOwned(userId, id);
    if ((await this.deps.userRepo.findDefaultScheduleId(userId)) === id) {
      throw new AppError("cannot_delete_default_schedule", 409);
    }
    await this.deps.scheduleRepo.deleteById(id);
  }

  private async findOwned(userId: number, id: number): Promise<ScheduleWithAvailability> {
    const found = await this.deps.scheduleRepo.findByIdIncludeAvailability(id);
    // Someone else's schedule is reported as missing, so ids can't be probed.
    if (!found || found.userId !== userId) throw new AppError("not_found", 404);
    return found;
  }

  private assertValid(input: ScheduleInput) {
    const error = validateSchedule(input);
    if (error) throw new AppError(error);
  }
}

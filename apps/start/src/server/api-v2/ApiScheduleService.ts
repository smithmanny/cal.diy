import "@tanstack/react-start/server-only";

import { AppError } from "../errors";
import type { ScheduleService } from "../schedules/ScheduleService";
import type { ApiUserRepository } from "./ApiUserRepository";
import type { ApiUser } from "./auth";
import { applyScheduleInput, type ScheduleApiInput, toScheduleOutput } from "./scheduleMapper";

type Deps = { schedules: ScheduleService; users: ApiUserRepository };

type ScheduleOutput = ReturnType<typeof toScheduleOutput>;

/** Cal's API v2 schedule endpoints (version 2024-06-11), on the app's ScheduleService. */
class ApiScheduleService {
  constructor(private readonly deps: Deps) {}

  async list(actor: ApiUser): Promise<ScheduleOutput[]> {
    const timeZone = await this.timeZone(actor);
    const summaries = await this.deps.schedules.list(actor.id, timeZone);
    const schedules = await Promise.all(
      summaries.map((summary) => this.deps.schedules.get(actor.id, summary.id, timeZone))
    );
    return schedules.map((schedule) => toScheduleOutput(schedule, actor.id));
  }

  async get(actor: ApiUser, id: number): Promise<ScheduleOutput> {
    const schedule = await this.deps.schedules.get(actor.id, id, await this.timeZone(actor));
    return toScheduleOutput(schedule, actor.id);
  }

  async getDefault(actor: ApiUser): Promise<ScheduleOutput | null> {
    const me = await this.deps.users.findMe(actor.id);
    return me?.defaultScheduleId ? this.get(actor, me.defaultScheduleId) : null;
  }

  async create(actor: ApiUser, input: ScheduleApiInput): Promise<ScheduleOutput> {
    const { id } = await this.deps.schedules.create(actor.id, applyScheduleInput(null, input));
    if (input.isDefault) await this.deps.schedules.setDefault(actor.id, id);
    return this.get(actor, id);
  }

  /** `isDefault: false` is ignored: a user always has a default, so another must be made default. */
  async update(actor: ApiUser, id: number, input: ScheduleApiInput): Promise<ScheduleOutput> {
    const current = await this.deps.schedules.get(actor.id, id, await this.timeZone(actor));
    await this.deps.schedules.update(actor.id, id, applyScheduleInput(current, input));
    if (input.isDefault) await this.deps.schedules.setDefault(actor.id, id);
    return this.get(actor, id);
  }

  async delete(actor: ApiUser, id: number): Promise<void> {
    await this.deps.schedules.delete(actor.id, id);
  }

  private async timeZone(actor: ApiUser): Promise<string> {
    const me = await this.deps.users.findMe(actor.id);
    if (!me) throw new AppError("unauthorized", 401);
    return me.timeZone;
  }
}

export { ApiScheduleService };

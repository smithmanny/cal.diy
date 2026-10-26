import "@tanstack/react-start/server-only";

import dayjs from "@calcom/dayjs";
import { AppError } from "../errors";
import type { OutOfOfficeRepository } from "./OutOfOfficeRepository";

export type OutOfOfficeInput = {
  /** Present when editing an existing entry. */
  uuid?: string;
  startDate: string;
  endDate: string;
  reasonId: number;
  notes: string | null;
  showNotePublicly: boolean;
};

export class OutOfOfficeService {
  constructor(private readonly deps: { oooRepo: OutOfOfficeRepository; newUuid: () => string }) {}

  /**
   * Like Cal, an entry covers whole days stored in UTC: from midnight of the first day to the end of
   * the last, so it reads the same wherever the host or the booker is.
   */
  async createOrUpdate(userId: number, input: OutOfOfficeInput): Promise<void> {
    const start = dayjs.utc(input.startDate).startOf("day").toDate();
    const end = dayjs.utc(input.endDate).endOf("day").toDate();
    if (start > end) throw new AppError("start_date_must_be_before_end_date");
    if (!(await this.deps.oooRepo.reasonExists(input.reasonId, userId))) throw new AppError("not_found", 404);
    if (await this.deps.oooRepo.existsWithSameRange(userId, start, end, input.uuid)) {
      throw new AppError("out_of_office_entry_already_exists", 409);
    }
    const data = {
      start,
      end,
      reasonId: input.reasonId,
      notes: input.notes?.trim() || null,
      showNotePublicly: input.showNotePublicly,
    };
    if (input.uuid) {
      const updated = await this.deps.oooRepo.updateByUuidAndUserId(input.uuid, userId, data);
      if (!updated) throw new AppError("not_found", 404);
      return;
    }
    await this.deps.oooRepo.create({ ...data, uuid: this.deps.newUuid(), userId });
  }

  async list(userId: number) {
    const entries = await this.deps.oooRepo.findManyByUserIdIncludeReason(userId);
    return entries.map((entry) => ({
      ...entry,
      // Dates the host picked, independent of where they view the list from.
      startDate: dayjs(entry.start).utc().format("YYYY-MM-DD"),
      endDate: dayjs(entry.end).utc().format("YYYY-MM-DD"),
    }));
  }
}

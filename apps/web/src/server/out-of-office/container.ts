import "@tanstack/react-start/server-only";

import { getDb } from "../db";
import { TeamRepository } from "../teams/TeamRepository";
import { OutOfOfficeRepository } from "./OutOfOfficeRepository";
import { OutOfOfficeService } from "./OutOfOfficeService";

export async function getOutOfOffice() {
  const db = await getDb();
  const oooRepo = new OutOfOfficeRepository(db);
  const teamRepo = new TeamRepository(db);
  const service = new OutOfOfficeService({
    oooRepo,
    newUuid: () => crypto.randomUUID(),
    isTeammate: async (userId, otherId) =>
      (await teamRepo.findTeammates(userId)).some((teammate) => teammate.id === otherId),
  });
  return { oooRepo, teamRepo, service };
}

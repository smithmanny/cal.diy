import "@tanstack/react-start/server-only";

import { getDb } from "../db";
import { OutOfOfficeRepository } from "./OutOfOfficeRepository";
import { OutOfOfficeService } from "./OutOfOfficeService";

export async function getOutOfOffice() {
  const oooRepo = new OutOfOfficeRepository(await getDb());
  return { oooRepo, service: new OutOfOfficeService({ oooRepo, newUuid: () => crypto.randomUUID() }) };
}

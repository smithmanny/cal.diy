import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../middleware";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getOutOfOffice } from "./container";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listOutOfOffice = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { oooRepo, service } = await getOutOfOffice();
    const [entries, reasons] = await Promise.all([
      service.list(context.userId),
      oooRepo.findReasonsForUser(context.userId),
    ]);
    return { entries, reasons };
  });

export const saveOutOfOffice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      uuid: z.string().uuid().optional(),
      startDate: isoDate,
      endDate: isoDate,
      reasonId: z.number().int().positive(),
      notes: z.string().max(1000).nullable(),
      showNotePublicly: z.boolean(),
    })
  )
  .handler(async ({ context, data }) => {
    const { service } = await getOutOfOffice();
    await service.createOrUpdate(context.userId, data);
  });

export const deleteOutOfOffice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ uuid: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { oooRepo } = await getOutOfOffice();
    await oooRepo.deleteByUuidAndUserId(data.uuid, context.userId);
  });

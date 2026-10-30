import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../middleware";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getScheduleService } from "./container";
import { scheduleInputSchema } from "./types";

const idSchema = z.object({ id: z.number().int().positive() });

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await getScheduleService()).list(context.userId, context.userTimeZone));

export const getSchedule = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) =>
    (await getScheduleService()).get(context.userId, data.id, context.userTimeZone)
  );

export const createSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(scheduleInputSchema)
  .handler(async ({ context, data }) => (await getScheduleService()).create(context.userId, data));

export const updateSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idSchema.extend({ schedule: scheduleInputSchema }))
  .handler(async ({ context, data }) =>
    (await getScheduleService()).update(context.userId, data.id, data.schedule)
  );

export const setDefaultSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => (await getScheduleService()).setDefault(context.userId, data.id));

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => (await getScheduleService()).delete(context.userId, data.id));

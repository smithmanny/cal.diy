import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { matchLocale } from "~/lib/locales";
import { AppError } from "../errors";
import { authMiddleware } from "../middleware";
import { isValidTimeZone } from "../schedules/scheduleMapper";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getUserRepository } from "./container";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await (await getUserRepository()).findProfile(context.userId);
    if (!profile) throw new AppError("not_found", 404);
    return profile;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(1).max(200),
      timeZone: z.string().min(1),
      locale: z.string().min(2).max(20),
    })
  )
  .handler(async ({ context, data }) => {
    if (!isValidTimeZone(data.timeZone)) throw new AppError("invalid_timezone");
    const locale = matchLocale(data.locale);
    if (!locale) throw new AppError("something_went_wrong");
    await (await getUserRepository()).updateProfile(context.userId, { ...data, locale });
  });

export const getSecurity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const security = await (await getUserRepository()).findSecurity(context.userId);
    if (!security) throw new AppError("not_found", 404);
    return security;
  });

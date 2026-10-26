import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../middleware";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getHolidayService } from "./container";

export const getHolidaySettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const service = await getHolidayService();
    if (!service.isEnabled()) return { enabled: false as const };
    const [settings, conflicts] = await Promise.all([
      service.settings(context.userId),
      service.conflicts(context.userId),
    ]);
    return { enabled: true as const, countries: service.countries(), ...settings, conflicts };
  });

export const setHolidayCountry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ countryCode: z.string().min(2).max(20).nullable() }))
  .handler(async ({ context, data }) => {
    await (await getHolidayService()).setCountry(context.userId, data.countryCode);
  });

export const toggleHoliday = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ holidayId: z.string().min(1).max(500), enabled: z.boolean() }))
  .handler(async ({ context, data }) => {
    await (await getHolidayService()).toggle(context.userId, data.holidayId, data.enabled);
  });

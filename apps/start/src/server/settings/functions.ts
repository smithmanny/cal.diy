import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_BRAND_COLOR, DEFAULT_DARK_BRAND_COLOR } from "~/lib/brand-color";
import { toThemePreference } from "~/lib/theme";
import { WEEK_DAY_NAMES } from "~/lib/time-format";
import { AppError } from "../errors";
import { authMiddleware } from "../middleware";
import { isValidTimeZone } from "../schedules/scheduleMapper";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getSettingsRepositories } from "./container";
import { travelPeriod } from "./travel";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const themeSchema = z.enum(["light", "dark"]).nullable();
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const getGeneralSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { users, travelSchedules } = await getSettingsRepositories();
    const [settings, travel] = await Promise.all([
      users.findGeneralSettings(context.userId),
      travelSchedules.findByUserId(context.userId),
    ]);
    if (!settings) throw new AppError("not_found", 404);
    return {
      ...settings,
      timeFormat: settings.timeFormat === 24 ? 24 : 12,
      allowDynamicBooking: settings.allowDynamicBooking ?? true,
      allowSEOIndexing: settings.allowSEOIndexing ?? true,
      requiresBookerEmailVerification: settings.requiresBookerEmailVerification ?? false,
      travelSchedules: travel,
    };
  });

export const updateGeneralSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      timeFormat: z.union([z.literal(12), z.literal(24)]),
      weekStart: z.enum(WEEK_DAY_NAMES),
      allowDynamicBooking: z.boolean(),
      allowSEOIndexing: z.boolean(),
      requiresBookerEmailVerification: z.boolean(),
    })
  )
  .handler(async ({ context, data }) => {
    const { users } = await getSettingsRepositories();
    await users.updateGeneralSettings(context.userId, data);
  });

export const addTravelSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ timeZone: z.string().min(1), startDate: isoDate, endDate: isoDate.nullable() }))
  .handler(async ({ context, data }) => {
    if (!isValidTimeZone(data.timeZone)) throw new AppError("invalid_timezone");
    if (data.endDate && data.endDate < data.startDate)
      throw new AppError("start_date_must_be_before_end_date");
    const { travelSchedules } = await getSettingsRepositories();
    const existing = await travelSchedules.findByUserId(context.userId);
    const period = travelPeriod(data);
    const overlaps = existing.some(
      (other) =>
        period.start.getTime() <= (other.endDate?.getTime() ?? Number.POSITIVE_INFINITY) &&
        other.startDate.getTime() <= (period.end?.getTime() ?? Number.POSITIVE_INFINITY)
    );
    if (overlaps) throw new AppError("overlaps_with_existing_schedule");
    await travelSchedules.create({
      userId: context.userId,
      timeZone: data.timeZone,
      startDate: period.start,
      endDate: period.end,
    });
  });

export const deleteTravelSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    const { travelSchedules } = await getSettingsRepositories();
    await travelSchedules.deleteByIdAndUserId(data.id, context.userId);
  });

export const getAppearance = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { users } = await getSettingsRepositories();
    const appearance = await users.findAppearance(context.userId);
    if (!appearance) throw new AppError("not_found", 404);
    return {
      theme: toThemePreference(appearance.theme),
      appTheme: toThemePreference(appearance.appTheme),
      brandColor: appearance.brandColor ?? DEFAULT_BRAND_COLOR,
      darkBrandColor: appearance.darkBrandColor ?? DEFAULT_DARK_BRAND_COLOR,
      hideBranding: appearance.hideBranding,
    };
  });

export const updateAppearance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      theme: themeSchema,
      appTheme: themeSchema,
      brandColor: hexColor,
      darkBrandColor: hexColor,
      hideBranding: z.boolean(),
    })
  )
  .handler(async ({ context, data }) => {
    const { users } = await getSettingsRepositories();
    await users.updateAppearance(context.userId, {
      ...data,
      brandColor: data.brandColor.toLowerCase(),
      darkBrandColor: data.darkBrandColor.toLowerCase(),
    });
  });

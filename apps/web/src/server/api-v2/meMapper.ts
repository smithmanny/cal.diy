import { z } from "zod";
import { WEEK_DAY_NAMES } from "~/lib/time-format";
import type { MeRow } from "./ApiUserRepository";

/** Cal's UpdateManagedUserInput, minus email changes, which need the verification flow in settings. */
const updateMeInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    bio: z.string().max(5000).nullable(),
    avatarUrl: z
      .string()
      .url()
      .max(2000)
      .refine((url) => /^https?:\/\//i.test(url), "avatarUrl must be an http(s) URL")
      .nullable(),
    timeFormat: z.union([z.literal(12), z.literal(24)]),
    defaultScheduleId: z.number().int().positive(),
    weekStart: z.enum(WEEK_DAY_NAMES),
    timeZone: z.string().min(1).max(100),
    locale: z.string().min(2).max(20),
  })
  .partial()
  .strict();

type UpdateMeInput = z.infer<typeof updateMeInputSchema>;

/** Cal's MeOutput. */
function toMeOutput(me: MeRow) {
  return {
    id: me.id,
    username: me.username ?? "",
    email: me.email,
    name: me.name,
    avatarUrl: me.avatarUrl,
    bio: me.bio,
    timeFormat: me.timeFormat === 24 ? 24 : 12,
    defaultScheduleId: me.defaultScheduleId,
    weekStart: me.weekStart,
    timeZone: me.timeZone,
    locale: me.locale ?? "en",
    organizationId: me.organizationId,
  };
}

export type { UpdateMeInput };
export { updateMeInputSchema, toMeOutput };

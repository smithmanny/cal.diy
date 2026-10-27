import { createFileRoute } from "@tanstack/react-router";
import { matchLocale } from "~/lib/locales";
import { getApiUserRepository } from "~/server/api-v2/container";
import { apiRoute, parseBody } from "~/server/api-v2/http";
import { toMeOutput, updateMeInputSchema } from "~/server/api-v2/meMapper";
import { AppError } from "~/server/errors";
import { getScheduleService } from "~/server/schedules/container";
import { isValidTimeZone } from "~/server/schedules/scheduleMapper";

async function findMe(userId: number) {
  const me = await (await getApiUserRepository()).findMe(userId);
  if (!me) throw new AppError("unauthorized", 401);
  return toMeOutput(me);
}

export const Route = createFileRoute("/api/v2/me")({
  server: {
    handlers: {
      GET: apiRoute(({ user }) => findMe(user.id)),
      PATCH: apiRoute(async ({ request, user }) => {
        const { defaultScheduleId, locale, ...input } = await parseBody(request, updateMeInputSchema);
        if (input.timeZone && !isValidTimeZone(input.timeZone)) throw new AppError("invalid_timezone");
        const matchedLocale = locale === undefined ? undefined : matchLocale(locale);
        if (matchedLocale === null) throw new AppError("something_went_wrong");
        // Through the schedule service, which checks the schedule is the user's own.
        if (defaultScheduleId) await (await getScheduleService()).setDefault(user.id, defaultScheduleId);
        await (await getApiUserRepository()).update(user.id, {
          ...input,
          ...(matchedLocale ? { locale: matchedLocale } : {}),
        });
        return findMe(user.id);
      }),
    },
  },
});

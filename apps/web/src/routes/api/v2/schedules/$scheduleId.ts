import { createFileRoute } from "@tanstack/react-router";
import { getApiScheduleService } from "~/server/api-v2/container";
import { apiRoute, parseBody, parseId } from "~/server/api-v2/http";
import { SCHEDULES_API_VERSION, updateScheduleInputSchema } from "~/server/api-v2/scheduleMapper";

const version = { version: SCHEDULES_API_VERSION };

export const Route = createFileRoute("/api/v2/schedules/$scheduleId")({
  server: {
    handlers: {
      GET: apiRoute(
        async ({ params, user }) =>
          (await getApiScheduleService()).get(user, parseId(params.scheduleId, "scheduleId")),
        version
      ),
      PATCH: apiRoute(async ({ request, params, user }) => {
        const id = parseId(params.scheduleId, "scheduleId");
        const input = await parseBody(request, updateScheduleInputSchema);
        return (await getApiScheduleService()).update(user, id, input);
      }, version),
      DELETE: apiRoute(
        async ({ params, user }) =>
          (await getApiScheduleService()).delete(user, parseId(params.scheduleId, "scheduleId")),
        version
      ),
    },
  },
});

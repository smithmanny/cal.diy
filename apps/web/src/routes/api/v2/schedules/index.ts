import { createFileRoute } from "@tanstack/react-router";
import { getApiScheduleService } from "~/server/api-v2/container";
import { apiRoute, parseBody, WithStatus } from "~/server/api-v2/http";
import { createScheduleInputSchema, SCHEDULES_API_VERSION } from "~/server/api-v2/scheduleMapper";

const version = { version: SCHEDULES_API_VERSION };

export const Route = createFileRoute("/api/v2/schedules/")({
  server: {
    handlers: {
      GET: apiRoute(async ({ user }) => (await getApiScheduleService()).list(user), version),
      POST: apiRoute(async ({ request, user }) => {
        const input = await parseBody(request, createScheduleInputSchema);
        return new WithStatus(201, await (await getApiScheduleService()).create(user, input));
      }, version),
    },
  },
});

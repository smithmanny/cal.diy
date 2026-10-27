import { createFileRoute } from "@tanstack/react-router";
import { getApiScheduleService } from "~/server/api-v2/container";
import { apiRoute } from "~/server/api-v2/http";
import { SCHEDULES_API_VERSION } from "~/server/api-v2/scheduleMapper";

export const Route = createFileRoute("/api/v2/schedules/default")({
  server: {
    handlers: {
      GET: apiRoute(async ({ user }) => (await getApiScheduleService()).getDefault(user), {
        version: SCHEDULES_API_VERSION,
      }),
    },
  },
});

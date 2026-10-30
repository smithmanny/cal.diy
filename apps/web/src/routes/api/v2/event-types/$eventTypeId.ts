import { createFileRoute } from "@tanstack/react-router";
import { getApiEventTypeService } from "~/server/api-v2/container";
import { EVENT_TYPES_API_VERSION, updateEventTypeInputSchema } from "~/server/api-v2/eventTypeMapper";
import { apiRoute, parseBody, parseId } from "~/server/api-v2/http";

const version = { version: EVENT_TYPES_API_VERSION };

export const Route = createFileRoute("/api/v2/event-types/$eventTypeId")({
  server: {
    handlers: {
      GET: apiRoute(
        async ({ params, url, user }) =>
          (await getApiEventTypeService()).get(user, parseId(params.eventTypeId, "eventTypeId"), url.origin),
        version
      ),
      PATCH: apiRoute(async ({ request, params, url, user }) => {
        const id = parseId(params.eventTypeId, "eventTypeId");
        const input = await parseBody(request, updateEventTypeInputSchema);
        return (await getApiEventTypeService()).update(user, id, input, url.origin);
      }, version),
      DELETE: apiRoute(
        async ({ params, user }) =>
          (await getApiEventTypeService()).delete(user, parseId(params.eventTypeId, "eventTypeId")),
        version
      ),
    },
  },
});

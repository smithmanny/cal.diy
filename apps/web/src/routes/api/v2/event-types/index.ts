import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getApiEventTypeService } from "~/server/api-v2/container";
import { createEventTypeInputSchema, EVENT_TYPES_API_VERSION } from "~/server/api-v2/eventTypeMapper";
import { apiRoute, parseBody, parseQuery, publicApiRoute, WithStatus } from "~/server/api-v2/http";

const listQuerySchema = z.object({
  username: z.string().min(1).max(100).optional(),
  eventSlug: z.string().min(1).max(200).optional(),
});

const version = { version: EVENT_TYPES_API_VERSION };

export const Route = createFileRoute("/api/v2/event-types/")({
  server: {
    handlers: {
      GET: publicApiRoute(async ({ url, user }) => {
        const query = parseQuery(url, listQuerySchema);
        return (await getApiEventTypeService()).list(user, query, url.origin);
      }, version),
      POST: apiRoute(async ({ request, url, user }) => {
        const input = await parseBody(request, createEventTypeInputSchema);
        return new WithStatus(201, await (await getApiEventTypeService()).create(user, input, url.origin));
      }, version),
    },
  },
});

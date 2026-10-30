import { createFileRoute } from "@tanstack/react-router";
import { apiRoute, parseBody, WithStatus } from "~/server/api-v2/http";
import { applyWebhookInput, createWebhookInputSchema, toWebhookOutput } from "~/server/api-v2/webhookMapper";
import { getWebhookService } from "~/server/webhooks/container";

export const Route = createFileRoute("/api/v2/webhooks/")({
  server: {
    handlers: {
      GET: apiRoute(async ({ user }) => {
        const webhooks = await (await getWebhookService()).list(user.id);
        return webhooks.map((webhook) => toWebhookOutput(webhook, user.id));
      }),
      POST: apiRoute(async ({ request, user }) => {
        const input = await parseBody(request, createWebhookInputSchema);
        const service = await getWebhookService();
        const { id } = await service.create(user.id, applyWebhookInput(null, input));
        return new WithStatus(201, toWebhookOutput(await service.get(user.id, id), user.id));
      }),
    },
  },
});

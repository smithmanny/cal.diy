import { createFileRoute } from "@tanstack/react-router";
import { apiRoute, parseBody } from "~/server/api-v2/http";
import { applyWebhookInput, toWebhookOutput, updateWebhookInputSchema } from "~/server/api-v2/webhookMapper";
import { AppError } from "~/server/errors";
import { getWebhookService } from "~/server/webhooks/container";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids are uuids; anything else can't be a webhook, so it is reported as missing. */
function webhookId(value: string): string {
  if (!UUID.test(value)) throw new AppError("not_found", 404);
  return value;
}

export const Route = createFileRoute("/api/v2/webhooks/$webhookId")({
  server: {
    handlers: {
      GET: apiRoute(async ({ params, user }) =>
        toWebhookOutput(await (await getWebhookService()).get(user.id, webhookId(params.webhookId)), user.id)
      ),
      PATCH: apiRoute(async ({ request, params, user }) => {
        const id = webhookId(params.webhookId);
        const input = await parseBody(request, updateWebhookInputSchema);
        const service = await getWebhookService();
        await service.update(user.id, id, applyWebhookInput(await service.get(user.id, id), input));
        return toWebhookOutput(await service.get(user.id, id), user.id);
      }),
      DELETE: apiRoute(async ({ params, user }) => {
        const id = webhookId(params.webhookId);
        const service = await getWebhookService();
        const webhook = await service.get(user.id, id);
        await service.delete(user.id, id);
        return toWebhookOutput(webhook, user.id);
      }),
    },
  },
});

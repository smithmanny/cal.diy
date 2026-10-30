import { z } from "zod";
import {
  SUPPORTED_TRIGGERS,
  type WebhookDto,
  type WebhookInput,
  webhookInputSchema,
} from "../webhooks/types";

/** Cal's CreateWebhookInputDto, for the triggers this app emits. */
const createWebhookInputSchema = z
  .object({
    subscriberUrl: webhookInputSchema.shape.subscriberUrl,
    triggers: z.array(z.enum(SUPPORTED_TRIGGERS)).min(1),
    active: z.boolean(),
    payloadTemplate: z.string().max(10000).nullable().optional(),
    secret: z.string().max(500).optional(),
  })
  .strict();

const updateWebhookInputSchema = createWebhookInputSchema.partial();

type WebhookApiInput = z.infer<typeof updateWebhookInputSchema>;

/** The webhook after the API's changes; an omitted secret keeps the stored one. */
function applyWebhookInput(current: WebhookDto | null, input: WebhookApiInput): WebhookInput {
  return {
    subscriberUrl: input.subscriberUrl ?? current?.subscriberUrl ?? "",
    eventTriggers: input.triggers ?? current?.eventTriggers ?? [],
    active: input.active ?? current?.active ?? true,
    payloadTemplate:
      input.payloadTemplate === undefined ? (current?.payloadTemplate ?? null) : input.payloadTemplate,
    secret: input.secret,
  };
}

/** Cal's UserWebhookOutputDto; the secret itself is never sent back. */
function toWebhookOutput(webhook: WebhookDto, userId: number) {
  return {
    id: webhook.id,
    userId,
    subscriberUrl: webhook.subscriberUrl,
    triggers: webhook.eventTriggers,
    active: webhook.active,
    payloadTemplate: webhook.payloadTemplate,
  };
}

export type { WebhookApiInput };
export { createWebhookInputSchema, updateWebhookInputSchema, applyWebhookInput, toWebhookOutput };

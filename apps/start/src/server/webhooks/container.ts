import "@tanstack/react-start/server-only";

import { getDb } from "../db";
import { WebhookRepository } from "./WebhookRepository";
import { WebhookService } from "./WebhookService";

export async function getWebhookService(): Promise<WebhookService> {
  return new WebhookService(new WebhookRepository(await getDb()));
}

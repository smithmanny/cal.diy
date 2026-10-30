import "@tanstack/react-start/server-only";

import { AppError } from "../errors";
import { deliverWebhook } from "./payload";
import { SUPPORTED_TRIGGERS, type SupportedTrigger, type WebhookDto, type WebhookInput } from "./types";
import { isAllowedWebhookUrl } from "./urlPolicy";
import type { WebhookRepository, WebhookRow } from "./WebhookRepository";

function toDto(row: WebhookRow): WebhookDto {
  const triggers = (row.eventTriggers ?? []).filter((trigger): trigger is SupportedTrigger =>
    (SUPPORTED_TRIGGERS as readonly string[]).includes(trigger)
  );
  // The secret is write-only: it signs payloads and is never sent back to the browser.
  return {
    id: row.id,
    subscriberUrl: row.subscriberUrl,
    eventTriggers: triggers,
    active: row.active,
    hasSecret: Boolean(row.secret),
    payloadTemplate: row.payloadTemplate,
  };
}

function assertAllowedUrl(url: string): void {
  if (!isAllowedWebhookUrl(url)) throw new AppError("webhook_url_not_allowed", 400);
}

export class WebhookService {
  constructor(
    private readonly repo: WebhookRepository,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async list(userId: number): Promise<WebhookDto[]> {
    return (await this.repo.findManyByUserId(userId)).map(toDto);
  }

  async get(userId: number, id: string): Promise<WebhookDto> {
    return toDto(await this.findOwned(userId, id));
  }

  async create(userId: number, input: WebhookInput): Promise<{ id: string }> {
    assertAllowedUrl(input.subscriberUrl);
    if (await this.repo.findByUserIdAndUrl(userId, input.subscriberUrl))
      throw new AppError("webhook_subscriber_url_reserved", 409);
    const id = crypto.randomUUID();
    await this.repo.create({
      id,
      userId,
      subscriberUrl: input.subscriberUrl,
      eventTriggers: input.eventTriggers,
      active: input.active,
      secret: input.secret || null,
      payloadTemplate: input.payloadTemplate || null,
    });
    return { id };
  }

  async update(userId: number, id: string, input: WebhookInput): Promise<void> {
    const current = await this.findOwned(userId, id);
    assertAllowedUrl(input.subscriberUrl);
    if (input.subscriberUrl !== current.subscriberUrl) {
      const clash = await this.repo.findByUserIdAndUrl(userId, input.subscriberUrl);
      if (clash) throw new AppError("webhook_subscriber_url_reserved", 409);
    }
    await this.repo.update(id, {
      subscriberUrl: input.subscriberUrl,
      eventTriggers: input.eventTriggers,
      active: input.active,
      payloadTemplate: input.payloadTemplate || null,
      ...(input.secret === undefined ? {} : { secret: input.secret || null }),
    });
  }

  async delete(userId: number, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.repo.deleteById(id);
  }

  /** Cal's "Ping test": sends a PING to the URL being configured, before or after saving. */
  async ping(subscriberUrl: string, secret: string | null): Promise<{ ok: boolean; status: number }> {
    assertAllowedUrl(subscriberUrl);
    try {
      return await deliverWebhook(
        { subscriberUrl, secret, payloadTemplate: null },
        "PING",
        { message: "Hello from Cal.diy!" },
        this.fetchImpl
      );
    } catch {
      return { ok: false, status: 0 };
    }
  }

  private async findOwned(userId: number, id: string): Promise<WebhookRow> {
    const found = await this.repo.findById(id);
    if (!found || found.userId !== userId) throw new AppError("not_found", 404);
    return found;
  }
}

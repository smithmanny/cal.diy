import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { webhook } from "@calcom/db/schema";
import { and, asc, eq } from "drizzle-orm";

const columns = {
  id: webhook.id,
  userId: webhook.userId,
  subscriberUrl: webhook.subscriberUrl,
  eventTriggers: webhook.eventTriggers,
  active: webhook.active,
  secret: webhook.secret,
  payloadTemplate: webhook.payloadTemplate,
};

export type WebhookRow = Awaited<ReturnType<WebhookRepository["findManyByUserId"]>>[number];

export class WebhookRepository {
  constructor(private readonly db: Database) {}

  findManyByUserId(userId: number) {
    return this.db
      .select(columns)
      .from(webhook)
      .where(eq(webhook.userId, userId))
      .orderBy(asc(webhook.createdAt));
  }

  findActiveByUserId(userId: number) {
    return this.db
      .select(columns)
      .from(webhook)
      .where(and(eq(webhook.userId, userId), eq(webhook.active, true)));
  }

  async findById(id: string) {
    const [found] = await this.db.select(columns).from(webhook).where(eq(webhook.id, id)).limit(1);
    return found ?? null;
  }

  async findByUserIdAndUrl(userId: number, subscriberUrl: string) {
    const [found] = await this.db
      .select({ id: webhook.id })
      .from(webhook)
      .where(and(eq(webhook.userId, userId), eq(webhook.subscriberUrl, subscriberUrl)))
      .limit(1);
    return found ?? null;
  }

  async create(data: typeof webhook.$inferInsert) {
    await this.db.insert(webhook).values(data);
  }

  async update(id: string, data: Partial<typeof webhook.$inferInsert>) {
    await this.db.update(webhook).set(data).where(eq(webhook.id, id));
  }

  async deleteById(id: string) {
    await this.db.delete(webhook).where(eq(webhook.id, id));
  }
}

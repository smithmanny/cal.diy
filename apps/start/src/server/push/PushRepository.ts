import "@tanstack/react-start/server-only";
import type { Database } from "@calcom/db/database";
import { notificationsSubscriptions } from "@calcom/db/schema";
import { and, eq, inArray, like, type SQL } from "drizzle-orm";
import type { PushSubscriptionJson } from "./webPush";

type Row = { id: number; subscription: string };

function parse(row: Row): { id: number; subscription: PushSubscriptionJson } | null {
  try {
    const value: unknown = JSON.parse(row.subscription);
    if (typeof value !== "object" || value === null) return null;
    const { endpoint, keys } = value as Partial<PushSubscriptionJson>;
    if (typeof endpoint !== "string" || typeof keys?.p256dh !== "string" || typeof keys.auth !== "string")
      return null;
    return { id: row.id, subscription: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } } };
  } catch {
    return null;
  }
}

/** Cal's NotificationsSubscriptions: one row per browser, holding its PushSubscription as JSON. */
export class PushRepository {
  constructor(private readonly db: Database) {}

  async findByUserId(userId: number) {
    const rows = await this.db
      .select({ id: notificationsSubscriptions.id, subscription: notificationsSubscriptions.subscription })
      .from(notificationsSubscriptions)
      .where(eq(notificationsSubscriptions.userId, userId));
    return rows.flatMap((row) => parse(row) ?? []);
  }

  /** Stores the subscription, replacing any earlier one for the same browser endpoint. */
  async save(userId: number, subscription: PushSubscriptionJson): Promise<void> {
    const stale = await this.idsForEndpoint(subscription.endpoint);
    const insert = this.db
      .insert(notificationsSubscriptions)
      .values({ userId, subscription: JSON.stringify(subscription) });
    if (!stale.length) {
      await insert;
      return;
    }
    await this.db.batch([
      this.db.delete(notificationsSubscriptions).where(inArray(notificationsSubscriptions.id, stale)),
      insert,
    ]);
  }

  async removeByEndpoint(userId: number, endpoint: string): Promise<void> {
    const ids = await this.idsForEndpoint(endpoint, eq(notificationsSubscriptions.userId, userId));
    if (ids.length)
      await this.db.delete(notificationsSubscriptions).where(inArray(notificationsSubscriptions.id, ids));
  }

  async removeById(id: number): Promise<void> {
    await this.db.delete(notificationsSubscriptions).where(eq(notificationsSubscriptions.id, id));
  }

  /** Rows for an endpoint: narrowed in SQL, then matched exactly, since LIKE treats `_` as a wildcard. */
  private async idsForEndpoint(endpoint: string, scope?: SQL): Promise<number[]> {
    const rows = await this.db
      .select({ id: notificationsSubscriptions.id, subscription: notificationsSubscriptions.subscription })
      .from(notificationsSubscriptions)
      .where(and(scope, like(notificationsSubscriptions.subscription, `%${endpoint}%`)));
    return rows.flatMap((row) => {
      const parsed = parse(row);
      return parsed?.subscription.endpoint === endpoint ? [parsed.id] : [];
    });
  }
}

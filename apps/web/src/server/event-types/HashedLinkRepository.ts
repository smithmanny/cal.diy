import "@tanstack/react-start/server-only";
import type { Database } from "@calcom/db/database";
import { eventType, hashedLink, user } from "@calcom/db/schema";
import { and, asc, eq, inArray, lt, notInArray, sql } from "drizzle-orm";

export type HashedLinkInput = { link: string; expiresAt: Date | null; maxUsageCount: number };

/** Cal's private links (HashedLink): URLs to an event type that expire by date or by use. */
export class HashedLinkRepository {
  constructor(private readonly db: Database) {}

  findByEventTypeId(eventTypeId: number) {
    return this.db
      .select({
        link: hashedLink.link,
        expiresAt: hashedLink.expiresAt,
        maxUsageCount: hashedLink.maxUsageCount,
        usageCount: hashedLink.usageCount,
      })
      .from(hashedLink)
      .where(eq(hashedLink.eventTypeId, eventTypeId))
      .orderBy(asc(hashedLink.id));
  }

  /** The link with what booking through it needs: its event type, and the owner's username. */
  async findByLink(link: string) {
    const [found] = await this.db
      .select({
        id: hashedLink.id,
        expiresAt: hashedLink.expiresAt,
        maxUsageCount: hashedLink.maxUsageCount,
        usageCount: hashedLink.usageCount,
        eventTypeId: hashedLink.eventTypeId,
        slug: eventType.slug,
        username: user.username,
      })
      .from(hashedLink)
      .innerJoin(eventType, eq(eventType.id, hashedLink.eventTypeId))
      .innerJoin(user, eq(user.id, eventType.userId))
      .where(eq(hashedLink.link, link))
      .limit(1);
    return found ?? null;
  }

  /** Links in `links` that already belong to another event type. */
  async findTakenElsewhere(eventTypeId: number, links: string[]): Promise<string[]> {
    if (!links.length) return [];
    const rows = await this.db
      .select({ link: hashedLink.link })
      .from(hashedLink)
      .where(and(inArray(hashedLink.link, links), sql`${hashedLink.eventTypeId} <> ${eventTypeId}`));
    return rows.map((row) => row.link);
  }

  /**
   * Makes the event type's links exactly `links`: removed ones are deleted, existing ones keep
   * their usage count, new ones are added. One batch, so a failure changes nothing.
   */
  async replaceForEventType(eventTypeId: number, links: HashedLinkInput[]): Promise<void> {
    const kept = links.map((entry) => entry.link);
    await this.db.batch([
      this.db
        .delete(hashedLink)
        .where(
          and(
            eq(hashedLink.eventTypeId, eventTypeId),
            kept.length ? notInArray(hashedLink.link, kept) : undefined
          )
        ),
      ...links.map((entry) =>
        this.db
          .insert(hashedLink)
          .values({ eventTypeId, ...entry })
          .onConflictDoUpdate({
            target: hashedLink.link,
            set: { expiresAt: entry.expiresAt, maxUsageCount: entry.maxUsageCount },
            // Never take over another event type's link.
            setWhere: eq(hashedLink.eventTypeId, eventTypeId),
          })
      ),
    ]);
  }

  /** Counts one use, unless the link is used up; true when the use was counted. */
  async incrementUsage(id: number): Promise<boolean> {
    const updated = await this.db
      .update(hashedLink)
      .set({ usageCount: sql`${hashedLink.usageCount} + 1` })
      .where(and(eq(hashedLink.id, id), lt(hashedLink.usageCount, hashedLink.maxUsageCount)))
      .returning({ id: hashedLink.id });
    return updated.length > 0;
  }
}

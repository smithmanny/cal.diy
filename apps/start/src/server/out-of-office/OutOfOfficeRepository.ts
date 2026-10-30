import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { outOfOfficeEntry, outOfOfficeReason, user } from "@calcom/db/schema";
import { and, asc, eq, gte, isNull, lte, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

/** The teammate an entry forwards bookings to (Cal's OOO redirect). */
const toUser = alias(user, "to_user");

const entryColumns = {
  uuid: outOfOfficeEntry.uuid,
  start: outOfOfficeEntry.start,
  end: outOfOfficeEntry.end,
  notes: outOfOfficeEntry.notes,
  showNotePublicly: outOfOfficeEntry.showNotePublicly,
  reasonId: outOfOfficeEntry.reasonId,
  toUserId: outOfOfficeEntry.toUserId,
  reason: outOfOfficeReason.reason,
  emoji: outOfOfficeReason.emoji,
};

export class OutOfOfficeRepository {
  constructor(private readonly db: Database) {}

  /** Cal's stock reasons plus any the user created themselves. */
  findReasonsForUser(userId: number) {
    return this.db
      .select({ id: outOfOfficeReason.id, reason: outOfOfficeReason.reason, emoji: outOfOfficeReason.emoji })
      .from(outOfOfficeReason)
      .where(
        and(
          eq(outOfOfficeReason.enabled, true),
          or(isNull(outOfOfficeReason.userId), eq(outOfOfficeReason.userId, userId))
        )
      )
      .orderBy(asc(outOfOfficeReason.id));
  }

  findManyByUserIdIncludeReason(userId: number) {
    return this.db
      .select(entryColumns)
      .from(outOfOfficeEntry)
      .leftJoin(outOfOfficeReason, eq(outOfOfficeReason.id, outOfOfficeEntry.reasonId))
      .where(eq(outOfOfficeEntry.userId, userId))
      .orderBy(asc(outOfOfficeEntry.start));
  }

  /** Entries overlapping [from, to], with what the booker shows about them. */
  async findOverlappingIncludeReasonAndUsers(userId: number, from: Date, to: Date) {
    const rows = await this.db
      .select({
        start: outOfOfficeEntry.start,
        end: outOfOfficeEntry.end,
        notes: outOfOfficeEntry.notes,
        showNotePublicly: outOfOfficeEntry.showNotePublicly,
        userId: outOfOfficeEntry.userId,
        userName: user.name,
        toUserId: toUser.id,
        toUserName: toUser.name,
        toUsername: toUser.username,
        reason: outOfOfficeReason.reason,
        emoji: outOfOfficeReason.emoji,
      })
      .from(outOfOfficeEntry)
      .innerJoin(user, eq(user.id, outOfOfficeEntry.userId))
      .leftJoin(toUser, eq(toUser.id, outOfOfficeEntry.toUserId))
      .leftJoin(outOfOfficeReason, eq(outOfOfficeReason.id, outOfOfficeEntry.reasonId))
      .where(
        and(
          eq(outOfOfficeEntry.userId, userId),
          lte(outOfOfficeEntry.start, to),
          gte(outOfOfficeEntry.end, from)
        )
      );
    return rows.map((row) => ({
      start: row.start,
      end: row.end,
      notes: row.notes,
      showNotePublicly: row.showNotePublicly,
      user: { id: row.userId, name: row.userName },
      toUser: row.toUserId ? { id: row.toUserId, name: row.toUserName, username: row.toUsername } : null,
      reason: row.reason && row.emoji ? { reason: row.reason, emoji: row.emoji } : null,
    }));
  }

  async existsWithSameRange(userId: number, start: Date, end: Date, exceptUuid?: string): Promise<boolean> {
    const [found] = await this.db
      .select({ uuid: outOfOfficeEntry.uuid })
      .from(outOfOfficeEntry)
      .where(
        and(
          eq(outOfOfficeEntry.userId, userId),
          eq(outOfOfficeEntry.start, start),
          eq(outOfOfficeEntry.end, end),
          exceptUuid ? ne(outOfOfficeEntry.uuid, exceptUuid) : undefined
        )
      )
      .limit(1);
    return Boolean(found);
  }

  async reasonExists(reasonId: number, userId: number): Promise<boolean> {
    const [found] = await this.db
      .select({ id: outOfOfficeReason.id })
      .from(outOfOfficeReason)
      .where(
        and(
          eq(outOfOfficeReason.id, reasonId),
          or(isNull(outOfOfficeReason.userId), eq(outOfOfficeReason.userId, userId))
        )
      )
      .limit(1);
    return Boolean(found);
  }

  async create(data: {
    uuid: string;
    userId: number;
    start: Date;
    end: Date;
    reasonId: number;
    notes: string | null;
    showNotePublicly: boolean;
    toUserId: number | null;
  }): Promise<void> {
    await this.db.insert(outOfOfficeEntry).values(data);
  }

  /** Returns false when no entry with that uuid belongs to the user. */
  async updateByUuidAndUserId(
    uuid: string,
    userId: number,
    data: {
      start: Date;
      end: Date;
      reasonId: number;
      notes: string | null;
      showNotePublicly: boolean;
      toUserId: number | null;
    }
  ): Promise<boolean> {
    const updated = await this.db
      .update(outOfOfficeEntry)
      .set(data)
      .where(and(eq(outOfOfficeEntry.uuid, uuid), eq(outOfOfficeEntry.userId, userId)))
      .returning({ uuid: outOfOfficeEntry.uuid });
    return updated.length > 0;
  }

  async deleteByUuidAndUserId(uuid: string, userId: number): Promise<void> {
    await this.db
      .delete(outOfOfficeEntry)
      .where(and(eq(outOfOfficeEntry.uuid, uuid), eq(outOfOfficeEntry.userId, userId)));
  }
}

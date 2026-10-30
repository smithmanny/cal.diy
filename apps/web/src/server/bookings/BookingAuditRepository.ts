import "@tanstack/react-start/server-only";
import type { Database } from "@calcom/db/database";
import type { BookingAuditAction, BookingAuditSource } from "@calcom/db/enums";
import type { JsonValue } from "@calcom/db/ids";
import { auditActor, bookingAudit, user } from "@calcom/db/schema";
import { asc, eq, inArray, sql } from "drizzle-orm";

/** Who did something to a booking: a signed-in user, a booker or guest by email, or the system. */
type AuditActorRef =
  | { type: "USER"; userId: number }
  | { type: "GUEST"; email: string; name: string | null }
  | { type: "SYSTEM" };

type NewBookingAudit = {
  bookingUid: string;
  action: BookingAuditAction;
  /** Cal stores each action's fields with a version, so later shapes can coexist with old rows. */
  fields: { [key: string]: JsonValue };
  timestamp: Date;
  /** Ties together the records one request wrote (e.g. every occurrence of a series). */
  operationId: string;
  source: BookingAuditSource;
};

const RECORD_TYPE: Partial<Record<BookingAuditAction, "RECORD_CREATED" | "RECORD_UPDATED">> = {
  CREATED: "RECORD_CREATED",
  SEAT_BOOKED: "RECORD_CREATED",
};

/**
 * Cal's booking audit trail (AuditActor and BookingAudit), written in Cal's format so history
 * imported from Cal reads the same.
 */
export class BookingAuditRepository {
  constructor(private readonly db: Database) {}

  /** The actor's id, created on first use; users and emails each have one actor. */
  async actorId(actor: AuditActorRef): Promise<string> {
    if (actor.type === "USER") {
      const userUuid = await this.userUuid(actor.userId);
      if (userUuid) {
        const [row] = await this.db
          .insert(auditActor)
          .values({ type: "USER", userUuid })
          .onConflictDoUpdate({ target: auditActor.userUuid, set: { userUuid } })
          .returning({ id: auditActor.id });
        return row.id;
      }
      return this.actorId({ type: "SYSTEM" });
    }
    if (actor.type === "GUEST") {
      const email = actor.email.toLowerCase();
      const [row] = await this.db
        .insert(auditActor)
        .values({ type: "GUEST", email, name: actor.name })
        .onConflictDoUpdate({
          target: auditActor.email,
          set: { name: sql`coalesce(excluded."name", ${auditActor.name})` },
        })
        .returning({ id: auditActor.id });
      return row.id;
    }
    const [existing] = await this.db
      .select({ id: auditActor.id })
      .from(auditActor)
      .where(eq(auditActor.type, "SYSTEM"))
      .limit(1);
    if (existing) return existing.id;
    const [created] = await this.db
      .insert(auditActor)
      .values({ type: "SYSTEM" })
      .returning({ id: auditActor.id });
    return created.id;
  }

  async userUuid(userId: number): Promise<string | null> {
    const [row] = await this.db.select({ uuid: user.uuid }).from(user).where(eq(user.id, userId)).limit(1);
    return row?.uuid ?? null;
  }

  async userNamesByUuid(uuids: string[]): Promise<Map<string, string>> {
    if (!uuids.length) return new Map();
    const rows = await this.db
      .select({ uuid: user.uuid, name: user.name, email: user.email })
      .from(user)
      .where(inArray(user.uuid, uuids));
    return new Map(rows.map((row) => [row.uuid, row.name || row.email]));
  }

  async insertMany(actorId: string, entries: NewBookingAudit[]): Promise<void> {
    if (!entries.length) return;
    await this.db.insert(bookingAudit).values(
      entries.map((entry) => ({
        bookingUid: entry.bookingUid,
        actorId,
        type: RECORD_TYPE[entry.action] ?? "RECORD_UPDATED",
        action: entry.action,
        timestamp: entry.timestamp,
        source: entry.source,
        operationId: entry.operationId,
        data: { version: 1, fields: entry.fields },
      }))
    );
  }

  /** Oldest first, with whoever acted: a user's current name, or the name and email recorded. */
  findByBookingUid(bookingUid: string) {
    return this.db
      .select({
        id: bookingAudit.id,
        action: bookingAudit.action,
        timestamp: bookingAudit.timestamp,
        source: bookingAudit.source,
        data: bookingAudit.data,
        actorType: auditActor.type,
        actorName: sql<string | null>`coalesce(${user.name}, ${auditActor.name})`,
        actorEmail: sql<string | null>`coalesce(${user.email}, ${auditActor.email})`,
      })
      .from(bookingAudit)
      .innerJoin(auditActor, eq(auditActor.id, bookingAudit.actorId))
      .leftJoin(user, eq(user.uuid, auditActor.userUuid))
      .where(eq(bookingAudit.bookingUid, bookingUid))
      .orderBy(asc(bookingAudit.timestamp), asc(bookingAudit.id));
  }
}

export type { AuditActorRef, NewBookingAudit };

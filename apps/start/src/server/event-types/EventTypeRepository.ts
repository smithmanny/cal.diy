import "@tanstack/react-start/server-only";
import type { Database } from "@calcom/db/database";
import { chunkRowsForInsert } from "@calcom/db/insert-chunks";
import { eventType } from "@calcom/db/schema";
import { and, asc, desc, eq, max, ne } from "drizzle-orm";

const summaryColumns = {
  id: eventType.id,
  title: eventType.title,
  slug: eventType.slug,
  length: eventType.length,
  hidden: eventType.hidden,
  description: eventType.description,
  eventTypeColor: eventType.eventTypeColor,
};

const detailColumns = {
  ...summaryColumns,
  userId: eventType.userId,
  scheduleId: eventType.scheduleId,
  locations: eventType.locations,
  minimumBookingNotice: eventType.minimumBookingNotice,
  beforeEventBuffer: eventType.beforeEventBuffer,
  afterEventBuffer: eventType.afterEventBuffer,
  slotInterval: eventType.slotInterval,
  periodType: eventType.periodType,
  periodDays: eventType.periodDays,
  periodCountCalendarDays: eventType.periodCountCalendarDays,
  requiresConfirmation: eventType.requiresConfirmation,
  periodStartDate: eventType.periodStartDate,
  periodEndDate: eventType.periodEndDate,
  offsetStart: eventType.offsetStart,
  onlyShowFirstAvailableSlot: eventType.onlyShowFirstAvailableSlot,
  bookingLimits: eventType.bookingLimits,
  durationLimits: eventType.durationLimits,
  maxActiveBookingsPerBooker: eventType.maxActiveBookingsPerBooker,
  maxActiveBookingPerBookerOfferReschedule: eventType.maxActiveBookingPerBookerOfferReschedule,
  bookingFields: eventType.bookingFields,
  disableGuests: eventType.disableGuests,
  metadata: eventType.metadata,
  requiresConfirmationWillBlockSlot: eventType.requiresConfirmationWillBlockSlot,
  disableCancelling: eventType.disableCancelling,
  disableRescheduling: eventType.disableRescheduling,
  minimumRescheduleNotice: eventType.minimumRescheduleNotice,
  successRedirectUrl: eventType.successRedirectUrl,
  forwardParamsSuccessRedirect: eventType.forwardParamsSuccessRedirect,
  eventName: eventType.eventName,
  hideCalendarNotes: eventType.hideCalendarNotes,
  hideCalendarEventDetails: eventType.hideCalendarEventDetails,
  hideOrganizerEmail: eventType.hideOrganizerEmail,
  lockTimeZoneToggleOnBookingPage: eventType.lockTimeZoneToggleOnBookingPage,
  lockedTimeZone: eventType.lockedTimeZone,
  eventTypeColor: eventType.eventTypeColor,
  interfaceLanguage: eventType.interfaceLanguage,
  requiresBookerEmailVerification: eventType.requiresBookerEmailVerification,
  recurringEvent: eventType.recurringEvent,
};

type WritableColumns = Partial<Omit<typeof eventType.$inferInsert, "id" | "userId" | "teamId">>;

export type EventTypeRow = NonNullable<Awaited<ReturnType<EventTypeRepository["findById"]>>>;

export class EventTypeRepository {
  constructor(private readonly db: Database) {}

  findManyByUserId(userId: number) {
    return this.db
      .select(summaryColumns)
      .from(eventType)
      .where(eq(eventType.userId, userId))
      .orderBy(desc(eventType.position), asc(eventType.id));
  }

  async findById(id: number) {
    const [found] = await this.db.select(detailColumns).from(eventType).where(eq(eventType.id, id)).limit(1);
    return found ?? null;
  }

  findManyVisibleByUserId(userId: number) {
    return this.db
      .select(summaryColumns)
      .from(eventType)
      .where(and(eq(eventType.userId, userId), eq(eventType.hidden, false)))
      .orderBy(desc(eventType.position), asc(eventType.id));
  }

  async findByUserIdAndSlug(userId: number, slug: string) {
    const [found] = await this.db
      .select(detailColumns)
      .from(eventType)
      .where(and(eq(eventType.userId, userId), eq(eventType.slug, slug)))
      .limit(1);
    return found ?? null;
  }

  async slugExistsForUser(userId: number, slug: string, excludeId?: number): Promise<boolean> {
    const conditions = [eq(eventType.userId, userId), eq(eventType.slug, slug)];
    if (excludeId !== undefined) conditions.push(ne(eventType.id, excludeId));
    const [found] = await this.db
      .select({ id: eventType.id })
      .from(eventType)
      .where(and(...conditions))
      .limit(1);
    return Boolean(found);
  }

  async findMaxPositionForUser(userId: number): Promise<number> {
    const [row] = await this.db
      .select({ position: max(eventType.position) })
      .from(eventType)
      .where(eq(eventType.userId, userId));
    return row?.position ?? 0;
  }

  async create(userId: number, data: WritableColumns & { title: string; slug: string; length: number }) {
    const [created] = await this.db
      .insert(eventType)
      .values({ ...data, userId })
      .returning({ id: eventType.id });
    return created;
  }

  async createMany(
    userId: number,
    rows: (WritableColumns & { title: string; slug: string; length: number })[]
  ) {
    const values = rows.map((row) => ({ ...row, userId }));
    const [first, ...rest] = chunkRowsForInsert(eventType, values).map((chunk) =>
      this.db.insert(eventType).values(chunk)
    );
    if (first) await this.db.batch([first, ...rest]);
  }

  async update(id: number, data: WritableColumns) {
    await this.db.update(eventType).set(data).where(eq(eventType.id, id));
  }

  async deleteById(id: number) {
    await this.db.delete(eventType).where(eq(eventType.id, id));
  }
}

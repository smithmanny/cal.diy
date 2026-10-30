import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createLibsqlDatabase, migrateLibsqlDatabase } from "./drivers/libsql";
import { BookingStatus } from "./enums";
import { cuid, uuidv7 } from "./ids";
import { attendee, booking, eventType, user } from "./schema";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

async function freshDb() {
  const options = { url: `file:${join(tmpdir(), `cal-db-test-${crypto.randomUUID()}.db`)}` };
  await migrateLibsqlDatabase(options, migrationsFolder);
  return createLibsqlDatabase(options);
}

describe("database schema", () => {
  it("applies the baseline migration and round-trips a booking with relations", async () => {
    const db = await freshDb();
    const [owner] = await db
      .insert(user)
      .values({ email: "owner@example.com", username: "owner" })
      .returning();
    const [event] = await db
      .insert(eventType)
      .values({ title: "Intro", slug: "intro", length: 30, userId: owner.id })
      .returning();

    const start = new Date("2026-01-05T10:00:00Z");
    const [created] = await db
      .insert(booking)
      .values({
        uid: cuid(),
        title: "Intro call",
        startTime: start,
        endTime: new Date(start.getTime() + 30 * 60_000),
        userId: owner.id,
        eventTypeId: event.id,
      })
      .returning();
    await db
      .insert(attendee)
      .values({ email: "guest@example.com", name: "Guest", timeZone: "UTC", bookingId: created.id });

    const found = await db.query.booking.findFirst({
      where: eq(booking.id, created.id),
      columns: { id: true, status: true, startTime: true },
      with: { attendees: { columns: { email: true } }, user: { columns: { email: true } } },
    });

    expect(found).toEqual({
      id: created.id,
      status: BookingStatus.ACCEPTED,
      startTime: start,
      attendees: [{ email: "guest@example.com" }],
      user: { email: "owner@example.com" },
    });
  });

  it("stores Postgres-style arrays and Json as JSON text", async () => {
    const db = await freshDb();
    const [created] = await db
      .insert(user)
      .values({ email: "json@example.com", metadata: { theme: "dark" }, theme: null })
      .returning({ id: user.id, metadata: user.metadata });

    expect(created.metadata).toEqual({ theme: "dark" });
  });

  it("enforces foreign keys like D1 does", async () => {
    const db = await freshDb();
    await expect(
      db.insert(eventType).values({ title: "Orphan", slug: "orphan", length: 15, userId: 9999 })
    ).rejects.toThrow();
  });

  it("runs batches atomically", async () => {
    const db = await freshDb();
    await expect(
      db.batch([
        db.insert(user).values({ email: "a@example.com" }),
        db.insert(user).values({ email: "a@example.com" }),
      ])
    ).rejects.toThrow();
    expect(await db.select({ id: user.id }).from(user)).toEqual([]);
  });
});

describe("libsql driver", () => {
  it("creates the database directory when it does not exist yet", async () => {
    const url = `file:${join(tmpdir(), `cal-db-test-${crypto.randomUUID()}`, "nested", "cal.db")}`;
    await migrateLibsqlDatabase({ url }, migrationsFolder);
    const db = await createLibsqlDatabase({ url });
    expect(await db.select({ id: user.id }).from(user)).toEqual([]);
  });
});

describe("ids", () => {
  it("generates RFC 9562 version 7 UUIDs", () => {
    expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("generates unique cuids", () => {
    const ids = new Set(Array.from({ length: 1000 }, cuid));
    expect(ids.size).toBe(1000);
  });
});

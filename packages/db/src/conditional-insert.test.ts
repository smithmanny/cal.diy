import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, notExists, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { conditionalInsert } from "./conditional-insert";
import { createLibsqlDatabase, migrateLibsqlDatabase } from "./drivers/libsql";
import { booking, user } from "./schema";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

async function freshDb() {
  const options = { url: `file:${join(tmpdir(), `cal-db-test-${crypto.randomUUID()}.db`)}` };
  await migrateLibsqlDatabase(options, migrationsFolder);
  return createLibsqlDatabase(options);
}

describe("conditionalInsert", () => {
  it("inserts with JS defaults and driver encoding when the condition holds, and nothing otherwise", async () => {
    const db = await freshDb();
    const [{ id: userId }] = await db
      .insert(user)
      .values({ email: "a@example.com" })
      .returning({ id: user.id });
    const startTime = new Date("2030-01-01T10:00:00Z");
    const values = {
      uid: "u1",
      userId,
      title: "T",
      startTime,
      endTime: new Date("2030-01-01T10:30:00Z"),
      responses: { name: "Guest" },
    };
    const unique = notExists(db.select({ one: sql`1` }).from(booking).where(eq(booking.uid, "u1")));

    await db.run(conditionalInsert(booking, values, unique));
    await db.run(conditionalInsert(booking, values, unique));

    const rows = await db
      .select({
        uid: booking.uid,
        startTime: booking.startTime,
        responses: booking.responses,
        scheduledJobs: booking.scheduledJobs,
        status: booking.status,
      })
      .from(booking);
    expect(rows).toEqual([
      { uid: "u1", startTime, responses: { name: "Guest" }, scheduledJobs: [], status: "ACCEPTED" },
    ]);
  });
});

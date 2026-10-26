import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import { chunkRowsForInsert, D1_MAX_BOUND_PARAMETERS } from "./insert-chunks";
import { availability, eventType } from "./schema";

// Building SQL needs no connection, only the dialect.
const db = drizzle.mock();

describe("chunkRowsForInsert", () => {
  it("keeps every chunk of fully populated rows within D1's parameter limit", () => {
    const rows = Array.from({ length: 40 }, (_, index) => ({
      userId: 1,
      scheduleId: 1,
      days: [1, 2, 3],
      startTime: new Date(0),
      endTime: new Date(0),
      date: new Date(0),
      eventTypeId: index,
    }));
    const chunks = chunkRowsForInsert(availability, rows);
    expect(chunks.flat()).toEqual(rows);
    for (const chunk of chunks) {
      expect(db.insert(availability).values(chunk).toSQL().params.length).toBeLessThanOrEqual(
        D1_MAX_BOUND_PARAMETERS
      );
    }
  });

  it("puts wide rows in a statement each", () => {
    const rows = [1, 2, 3].map((n) => ({ title: `T${n}`, slug: `t${n}`, length: 15, userId: 1 }));
    const chunks = chunkRowsForInsert(eventType, rows);
    expect(chunks).toEqual(rows.map((row) => [row]));
    expect(db.insert(eventType).values(chunks[0]).toSQL().params.length).toBeLessThanOrEqual(
      D1_MAX_BOUND_PARAMETERS
    );
  });

  it("returns no chunks for no rows", () => {
    expect(chunkRowsForInsert(availability, [])).toEqual([]);
  });
});

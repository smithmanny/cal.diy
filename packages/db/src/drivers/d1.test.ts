import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { user } from "../schema";
import { createD1Database } from "./d1";

type Recorded = { sql: string; params: unknown[] };

/** Just enough of a D1 binding to see which statements a batch sends. */
function recordingD1() {
  const batches: Recorded[][] = [];
  const statement = (text: string, params: unknown[] = []) => ({
    sql: text,
    params,
    bind: (...bound: unknown[]) => statement(text, bound),
  });
  const binding = {
    prepare: (text: string) => statement(text),
    batch: async (statements: Recorded[]) => {
      batches.push(statements.map(({ sql: text, params }) => ({ sql: text, params })));
      return statements.map(() => ({ results: [], success: true, meta: {} }));
    },
  };
  return { binding: binding as unknown as D1Database, batches };
}

describe("createD1Database batch", () => {
  it("sends raw statements with bound parameters alongside query builders", async () => {
    const { binding, batches } = recordingD1();
    const db = createD1Database(binding);

    await db.batch([
      db.run(sql`INSERT INTO ${user} (email) SELECT ${"a@example.com"} WHERE 1 = ${1}`),
      db.update(user).set({ name: "A" }).where(eq(user.id, 7)),
    ]);

    expect(batches).toHaveLength(1);
    expect(batches[0][0]).toEqual({
      sql: 'INSERT INTO "users" (email) SELECT ? WHERE 1 = ?',
      params: ["a@example.com", 1],
    });
    expect(batches[0][1].params).toContain(7);
  });
});

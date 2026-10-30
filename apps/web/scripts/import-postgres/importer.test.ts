import { createHash } from "node:crypto";
import type { Database } from "@calcom/db/database";
import { account, booking, eventType, host, membership, twoFactor, user } from "@calcom/db/schema";
import { symmetricEncrypt as betterAuthEncrypt } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../../src/server/auth/createAuth";
import { symmetricEncrypt as calEncrypt, symmetricDecrypt } from "../../src/server/crypto/symmetric";
import { createTestDb } from "../../src/test/testDb";
import type { SourceRow } from "./convert";
import { type RowSource, runImport } from "./importer";
import { importPlan } from "./plan";
import { inlineParams, libsqlTarget, sqlFileTarget } from "./targets";

const SECRET = "import-test-secret-that-is-long-enough";
const CAL_KEY = "0123456789abcdef0123456789abcdef";
const API_KEY_SECRET = "0123456789abcdef0123456789abcdef";
// "Password123", hashed the way Cal's bcryptjs did.
const BCRYPT_HASH = "$2b$04$yxyWVCgn3e8lTFpsV1iN6O32k5hMuBjoOZma/JYlrNNHtUE7SRcOW";

/** Rows the way `row_to_json` returns them from a Cal database. */
async function calDatabase(): Promise<Record<string, SourceRow[]>> {
  return {
    Team: [{ id: 3, name: "Sales" }],
    users: [
      {
        id: 1,
        uuid: "6a1c9a9e-1111-4c1d-8a7e-000000000001",
        username: "ada",
        email: "ada@example.com",
        emailVerified: "2024-01-02T03:04:05.678",
        timeZone: "Europe/London",
        created: "2023-01-01T00:00:00",
        twoFactorEnabled: true,
        twoFactorSecret: await calEncrypt("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", CAL_KEY),
        backupCodes: await calEncrypt(JSON.stringify(["abcde12345", null]), CAL_KEY),
        identityProvider: "CAL",
        role: "ADMIN",
        organizationId: 3,
        creationSource: "webapp",
      },
    ],
    UserPassword: [{ userId: 1, hash: BCRYPT_HASH }],
    Account: [],
    Schedule: [{ id: 1, userId: 1, name: "Working hours", timeZone: null }],
    Availability: [
      { id: 1, days: [1, 2, 3, 4, 5], startTime: "09:00:00", endTime: "17:00:00", date: null, scheduleId: 1 },
    ],
    EventType: [
      { id: 1, title: "Child", slug: "child", length: 15, userId: 1, parentId: 2, periodType: "unlimited" },
      {
        id: 2,
        title: "Parent",
        slug: "parent",
        length: 15,
        userId: 1,
        parentId: null,
        periodType: "rolling",
      },
      { id: 3, title: "Team", slug: "team", length: 15, teamId: 3, schedulingType: "roundRobin" },
      // A managed event type's team template doesn't come over.
      { id: 4, title: "Managed", slug: "managed", length: 15, teamId: 3, schedulingType: "managed" },
    ],
    Membership: [{ id: 7, teamId: 3, userId: 1, role: "OWNER", accepted: true }],
    Host: [{ userId: 1, eventTypeId: 3, isFixed: false }],
    Booking: [
      {
        id: 10,
        uid: "uid-10",
        userId: 1,
        eventTypeId: 3,
        title: "Team call",
        startTime: "2024-06-01T10:00:00",
        endTime: "2024-06-01T10:15:00",
        status: "accepted",
        responses: { name: "Bob" },
      },
    ],
    ApiKey: [
      {
        id: "key1",
        userId: 1,
        teamId: null,
        note: "Zapier",
        hashedKey: createHash("sha256").update(API_KEY_SECRET).digest("hex"),
        createdAt: "2024-01-01T00:00:00",
      },
    ],
  };
}

function memorySource(tables: Record<string, SourceRow[]>): RowSource {
  return {
    tables: async () => new Set(Object.keys(tables)),
    async *rows(table) {
      yield* tables[table] ?? [];
    },
  };
}

const crypto = {
  decryptCal: (text: string) => symmetricDecrypt(text, CAL_KEY),
  encryptBetterAuth: (data: string) => betterAuthEncrypt({ key: SECRET, data }),
  randomSecret: () => "a-random-secret-no-one-knows-1234",
};

function authFor(db: Database) {
  return createAuth({
    db,
    baseURL: "http://localhost:3000",
    secret: SECRET,
    clientIpHeaders: ["x-cal-client-ip"],
    rateLimit: false,
    sendAuthEmail: null,
  });
}

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("runImport", () => {
  it("imports a Cal database with its teams, members and team event types", async () => {
    const report = await runImport({
      source: memorySource(await calDatabase()),
      target: libsqlTarget(db),
      steps: importPlan(crypto),
    });

    expect(report.tables.find((table) => table.source === "EventType")).toMatchObject({
      imported: 3,
      skipped: 1,
    });
    expect(report.warnings).toContain("Skipped App: not in the source database.");

    const [ada] = await db.select().from(user);
    expect(ada).toMatchObject({
      emailVerified: true,
      organizationId: null,
      role: "ADMIN",
      creationSource: "WEBAPP",
    });
    // A row pointing at a later row of the same table gets its link once both exist.
    const types = await db
      .select({ id: eventType.id, parentId: eventType.parentId })
      .from(eventType)
      .orderBy(eventType.id);
    expect(types).toEqual([
      { id: 1, parentId: 2 },
      { id: 2, parentId: null },
      { id: 3, parentId: null },
    ]);
    // Organization members keep plain usernames, and still belong to the team.
    expect(
      await db.select({ role: membership.role, accepted: membership.accepted }).from(membership)
    ).toEqual([{ role: "OWNER", accepted: true }]);
    expect(await db.select({ eventTypeId: booking.eventTypeId }).from(booking)).toEqual([{ eventTypeId: 3 }]);
    expect(await db.select({ userId: host.userId, eventTypeId: host.eventTypeId }).from(host)).toEqual([
      { userId: 1, eventTypeId: 3 },
    ]);
  });

  it("lets imported users sign in with their password, a backup code and their API key", async () => {
    await runImport({
      source: memorySource(await calDatabase()),
      target: libsqlTarget(db),
      steps: importPlan(crypto),
    });
    const auth = authFor(db);

    const signIn = await auth.api.signInEmail({
      body: { email: "ada@example.com", password: "Password123" },
      asResponse: true,
    });
    expect(await signIn.json()).toMatchObject({ twoFactorRedirect: true });
    const verified = await auth.api.verifyBackupCode({
      headers: new Headers({
        cookie: signIn.headers
          .getSetCookie()
          .map((cookie) => cookie.split(";")[0])
          .join("; "),
      }),
      body: { code: "abcde-12345" },
      asResponse: true,
    });
    expect(verified.status, await verified.clone().text()).toBe(200);

    expect((await auth.api.verifyApiKey({ body: { key: API_KEY_SECRET } })).valid).toBe(true);

    const [credential] = await db
      .select({ password: account.password })
      .from(account)
      .where(eq(account.userId, 1));
    expect(credential.password).not.toBe(BCRYPT_HASH);
    expect(await db.select({ verified: twoFactor.verified }).from(twoFactor)).toEqual([{ verified: true }]);
  });

  it("writes SQL that loads the same data into an empty database (the D1 route)", async () => {
    const statements: string[] = [];
    await runImport({
      source: memorySource(await calDatabase()),
      target: sqlFileTarget((statement) => statements.push(statement)),
      steps: importPlan(crypto),
    });
    for (const statement of statements) await db.run(sql.raw(statement));

    expect(await db.select({ email: user.email }).from(user)).toEqual([{ email: "ada@example.com" }]);
    expect(
      await db
        .select({ id: eventType.id, parentId: eventType.parentId })
        .from(eventType)
        .orderBy(eventType.id)
    ).toEqual([
      { id: 1, parentId: 2 },
      { id: 2, parentId: null },
      { id: 3, parentId: null },
    ]);
  });
});

describe("inlineParams", () => {
  it("quotes values and leaves question marks inside quoted names alone", () => {
    expect(inlineParams('insert into "a?b" ("x", "y", "z") values (?, ?, ?)', ["it's", 3, null])).toBe(
      `insert into "a?b" ("x", "y", "z") values ('it''s', 3, NULL)`
    );
  });

  it("refuses a parameter count that doesn't match", () => {
    expect(() => inlineParams("select ?", [])).toThrow("Expected 0 placeholders, found 1");
  });
});

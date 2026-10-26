import type { Database } from "@calcom/db/database";
import { account, eventType, schedule, user } from "@calcom/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { AUTH_ERROR_CODES, createAuth } from "./createAuth";

const VALID_PASSWORD = "Secret123";

let db: Database;
let auth: ReturnType<typeof createAuth>;

beforeEach(async () => {
  db = await createTestDb();
  auth = createAuth({
    db,
    baseURL: "http://localhost:3000",
    secret: "test-secret-that-is-long-enough-123",
    clientIpHeaders: ["x-cal-client-ip"],
    rateLimit: false,
  });
});

function signUp(body: { email: string; password?: string; username?: string; timeZone?: string }) {
  return auth.api.signUpEmail({
    body: { name: body.username ?? body.email, password: VALID_PASSWORD, ...body },
  });
}

describe("createAuth", () => {
  it("signs a user up into the existing users table with an integer id and a credential account", async () => {
    const result = await signUp({
      email: "Owner@Example.com",
      username: "Owner Name",
      timeZone: "America/New_York",
    });

    const [row] = await db
      .select({
        id: user.id,
        email: user.email,
        username: user.username,
        timeZone: user.timeZone,
        emailVerified: user.emailVerified,
      })
      .from(user);
    expect(row).toEqual({
      id: Number(result.user.id),
      email: "owner@example.com",
      username: "owner-name",
      timeZone: "America/New_York",
      emailVerified: false,
    });

    const [credential] = await db
      .select({ providerId: account.providerId, password: account.password })
      .from(account)
      .where(eq(account.userId, row.id));
    expect(credential.providerId).toBe("credential");
    expect(credential.password).not.toContain(VALID_PASSWORD);
  });

  it("gives new users a default Mon-Fri 9-5 schedule in their time zone and default event types", async () => {
    const result = await signUp({ email: "tz@example.com", username: "tz", timeZone: "Asia/Kolkata" });

    const [row] = await db
      .select({ defaultScheduleId: user.defaultScheduleId })
      .from(user)
      .where(eq(user.id, Number(result.user.id)));
    const schedules = await db
      .select({ id: schedule.id, name: schedule.name, timeZone: schedule.timeZone })
      .from(schedule);
    expect(schedules).toEqual([
      { id: row.defaultScheduleId, name: "Working hours", timeZone: "Asia/Kolkata" },
    ]);
    const eventTypes = await db.select({ slug: eventType.slug, title: eventType.title }).from(eventType);
    expect(eventTypes).toEqual([
      { slug: "30min", title: "30 min meeting" },
      { slug: "15min", title: "15 min meeting" },
    ]);
  });

  it("falls back to a default time zone when the browser sends an invalid one", async () => {
    await signUp({ email: "badtz@example.com", username: "badtz", timeZone: "Not/AZone" });
    const [row] = await db.select({ timeZone: user.timeZone }).from(user);
    expect(row.timeZone).toBe("Europe/London");
  });

  it("rejects passwords that don't meet Cal's complexity rule", async () => {
    await expect(signUp({ email: "weak@example.com", password: "alllowercase" })).rejects.toMatchObject({
      body: { code: AUTH_ERROR_CODES.invalidPassword },
    });
    expect(await db.select({ id: user.id }).from(user)).toEqual([]);
  });

  it("rejects a username that is already taken", async () => {
    await signUp({ email: "first@example.com", username: "taken" });
    await expect(signUp({ email: "second@example.com", username: "taken" })).rejects.toMatchObject({
      body: { code: AUTH_ERROR_CODES.usernameTaken },
    });
  });

  it("rejects usernames that would shadow app routes", async () => {
    await expect(signUp({ email: "route@example.com", username: "Availability" })).rejects.toMatchObject({
      body: { code: AUTH_ERROR_CODES.usernameTaken },
    });
  });

  it("derives a free username from the email when none is given (OAuth sign-ups)", async () => {
    await signUp({ email: "alex@example.com", username: "alex" });
    await signUp({ email: "alex@another.com" });

    const usernames = (await db.select({ username: user.username }).from(user)).map((row) => row.username);
    expect(usernames[0]).toBe("alex");
    expect(usernames[1]).toMatch(/^alex-\d{4}$/);
  });

  it("signs in with the right password, resolves the session from its cookie, and refuses a wrong one", async () => {
    await signUp({ email: "login@example.com", username: "login" });

    await expect(
      auth.api.signInEmail({ body: { email: "login@example.com", password: "Wrong1234" } })
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });

    const response = await auth.api.signInEmail({
      body: { email: "login@example.com", password: VALID_PASSWORD },
      asResponse: true,
    });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("cal.session_token=");

    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookie ?? "" }) });
    expect(session?.user).toMatchObject({ email: "login@example.com", username: "login" });
  });
});

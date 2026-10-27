import { createHash } from "node:crypto";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import type { Database } from "@calcom/db/database";
import { account, apiKey, eventType, schedule, user } from "@calcom/db/schema";
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
    sendAuthEmail: null,
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

  it("signs in a user imported from Cal with their bcrypt hash, then stores Better Auth's hash", async () => {
    const [imported] = await db
      .insert(user)
      .values({ email: "imported@example.com", username: "imported", emailVerified: true })
      .returning({ id: user.id });
    // "Password123", hashed by Cal's bcryptjs.
    const bcryptHash = "$2b$04$yxyWVCgn3e8lTFpsV1iN6O32k5hMuBjoOZma/JYlrNNHtUE7SRcOW";
    await db.insert(account).values({
      userId: imported.id,
      providerId: "credential",
      accountId: String(imported.id),
      password: bcryptHash,
    });

    await expect(
      auth.api.signInEmail({ body: { email: "imported@example.com", password: "Password124" } })
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
    const signedIn = await auth.api.signInEmail({
      body: { email: "imported@example.com", password: "Password123" },
    });
    expect(signedIn.user.email).toBe("imported@example.com");

    const [stored] = await db
      .select({ password: account.password })
      .from(account)
      .where(eq(account.userId, imported.id));
    expect(stored.password).not.toBe(bcryptHash);
    await expect(
      auth.api.signInEmail({ body: { email: "imported@example.com", password: "Password123" } })
    ).resolves.toMatchObject({ user: { email: "imported@example.com" } });
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

describe("createAuth account security", () => {
  type SentEmail = { kind: string; email: string; url: string };
  let sent: SentEmail[];

  beforeEach(() => {
    sent = [];
    auth = createAuth({
      db,
      baseURL: "http://localhost:3000",
      secret: "test-secret-that-is-long-enough-123",
      clientIpHeaders: ["x-cal-client-ip"],
      rateLimit: false,
      sendAuthEmail: async (kind, recipient, url) => {
        sent.push({ kind, email: recipient.email, url });
      },
    });
  });

  async function sessionHeaders(email: string, password = VALID_PASSWORD) {
    const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    return new Headers({ cookie: response.headers.get("set-cookie") ?? "" });
  }

  it("emails a verification link on sign-up", async () => {
    await signUp({ email: "verify@example.com", username: "verify" });
    expect(sent).toEqual([
      {
        kind: "verify_email",
        email: "verify@example.com",
        url: expect.stringContaining("/api/auth/verify-email?token="),
      },
    ]);
  });

  it("resets a password from the emailed link, applying Cal's password rule", async () => {
    await signUp({ email: "reset@example.com", username: "reset" });
    await auth.api.requestPasswordReset({
      body: { email: "reset@example.com", redirectTo: "/auth/reset-password" },
    });
    const resetEmail = sent.find((email) => email.kind === "reset_password");
    const token = new URL(resetEmail?.url ?? "").pathname.split("/").pop() ?? "";
    expect(token).not.toBe("");

    await expect(
      auth.api.resetPassword({ body: { token, newPassword: "alllowercase" } })
    ).rejects.toMatchObject({ body: { code: AUTH_ERROR_CODES.invalidPassword } });

    await auth.api.resetPassword({ body: { token, newPassword: "NewSecret456" } });
    await expect(sessionHeaders("reset@example.com")).resolves.toBeDefined();
    await expect(
      auth.api.signInEmail({ body: { email: "reset@example.com", password: VALID_PASSWORD } })
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  });

  it("doesn't reveal whether an email has an account when asked for a reset", async () => {
    await expect(
      auth.api.requestPasswordReset({
        body: { email: "nobody@example.com", redirectTo: "/auth/reset-password" },
      })
    ).resolves.toMatchObject({ status: true });
    expect(sent).toEqual([]);
  });

  it("applies Cal's password rule when changing a password", async () => {
    await signUp({ email: "change@example.com", username: "change" });
    const headers = await sessionHeaders("change@example.com");
    await expect(
      auth.api.changePassword({ headers, body: { currentPassword: VALID_PASSWORD, newPassword: "short" } })
    ).rejects.toMatchObject({ body: { code: AUTH_ERROR_CODES.invalidPassword } });
    await auth.api.changePassword({
      headers,
      body: { currentPassword: VALID_PASSWORD, newPassword: "Changed789" },
    });
    await expect(sessionHeaders("change@example.com", "Changed789")).resolves.toBeDefined();
  });

  it("requires a TOTP code at sign-in once two-factor auth is verified", async () => {
    await signUp({ email: "totp@example.com", username: "totp" });
    const headers = await sessionHeaders("totp@example.com");
    const enabled = await auth.api.enableTwoFactor({ headers, body: { password: VALID_PASSWORD } });
    if (enabled.method !== "totp") throw new Error(`Expected TOTP setup, got ${enabled.method}`);
    expect(enabled.backupCodes).toHaveLength(10);

    // The URI carries the secret base32-encoded, as authenticator apps expect.
    const encoded = new URL(enabled.totpURI).searchParams.get("secret") ?? "";
    const code = await createOTP(new TextDecoder().decode(base32.decode(encoded))).totp();
    await auth.api.verifyTOTP({ headers, body: { code } });
    const [row] = await db.select({ twoFactorEnabled: user.twoFactorEnabled }).from(user);
    expect(row.twoFactorEnabled).toBe(true);

    const signIn = await auth.api.signInEmail({
      body: { email: "totp@example.com", password: VALID_PASSWORD },
      asResponse: true,
    });
    expect(await signIn.json()).toMatchObject({ twoFactorRedirect: true });
    const pendingCookies = new Headers({ cookie: signIn.headers.get("set-cookie") ?? "" });
    await expect(auth.api.getSession({ headers: pendingCookies })).resolves.toBeNull();
  });
});

describe("createAuth API keys", () => {
  async function signedInHeaders(email: string) {
    await signUp({ email, username: email.split("@")[0] });
    const response = await auth.api.signInEmail({
      body: { email, password: VALID_PASSWORD },
      asResponse: true,
    });
    return new Headers({ cookie: response.headers.get("set-cookie") ?? "" });
  }

  it("issues Cal-style keys that verify by their secret", async () => {
    const headers = await signedInHeaders("keys@example.com");
    const created = await auth.api.createApiKey({ headers, body: { name: "Zapier", prefix: "cal_" } });
    expect(created.key).toMatch(/^[0-9a-f]{32}$/);
    expect(created.prefix).toBe("cal_");

    const verified = await auth.api.verifyApiKey({ body: { key: created.key } });
    expect(verified.valid).toBe(true);
    const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, "keys@example.com"));
    expect(verified.key?.referenceId).toBe(String(owner.id));
    expect((await auth.api.verifyApiKey({ body: { key: `${created.key}0` } })).valid).toBe(false);
  });

  it("stores the same digest Cal kept as hex, so imported keys keep working", async () => {
    const headers = await signedInHeaders("digest@example.com");
    const created = await auth.api.createApiKey({ headers, body: { name: "Old", prefix: "cal_" } });
    const calHex = createHash("sha256").update(created.key).digest("hex");
    const [stored] = await db.select({ key: apiKey.key }).from(apiKey);
    expect(stored.key).toBe(Buffer.from(calHex, "hex").toString("base64url"));
  });

  it("answers plugin errors with their status over HTTP, not a 500", async () => {
    const headers = await signedInHeaders("http@example.com");
    headers.set("content-type", "application/json");
    headers.set("origin", "http://localhost:3000");
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/api-key/delete", {
        method: "POST",
        headers,
        body: JSON.stringify({ keyId: "999999" }),
      })
    );
    expect(response.status).toBe(404);
  });

  it("removes a user's keys with the user", async () => {
    const headers = await signedInHeaders("gone@example.com");
    await auth.api.createApiKey({ headers, body: { name: "Temp", prefix: "cal_" } });
    await db.delete(user).where(eq(user.email, "gone@example.com"));
    expect(await db.select({ id: apiKey.id }).from(apiKey)).toEqual([]);
  });
});

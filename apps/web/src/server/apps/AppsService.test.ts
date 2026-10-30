import type { Database } from "@calcom/db/database";
import { credential, user } from "@calcom/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../test/testDb";
import { CalendarRepository } from "../calendars/CalendarRepository";
import { CalendarService } from "../calendars/CalendarService";
import { calDavProvider } from "../calendars/caldav/CalDavClient";
import { createFakeCalDavState, FAKE_CALDAV_USER, fakeCalDavFetch } from "../calendars/caldav/fakeCalDav";
import { UserRepository } from "../users/UserRepository";
import { dailyProvider, jitsiProvider } from "../video/providers";
import { VideoRepository } from "../video/VideoRepository";
import { VideoService } from "../video/VideoService";
import { AppsService } from "./AppsService";
import { CredentialRepository } from "./CredentialRepository";
import { CredentialVault } from "./CredentialVault";

const KEY = "0123456789abcdef0123456789abcdef";
let db: Database;
let apps: AppsService;
let userId: number;

function service(withDaily: boolean) {
  const credentials = new CredentialRepository(db);
  const vault = new CredentialVault(KEY);
  return new AppsService({
    credentials,
    users: new UserRepository(db),
    calendars: new CalendarService(new CalendarRepository(db), credentials, {
      providers: [calDavProvider(fakeCalDavFetch(createFakeCalDavState()))],
      vault,
      publicUrl: "https://cal.test",
    }),
    video: new VideoService(new VideoRepository(db), credentials, {
      providers: [
        jitsiProvider("https://meet.jit.si/cal"),
        ...(withDaily ? [dailyProvider("k", "https://daily.test", "https://cal.test")] : []),
      ],
      vault,
    }),
  });
}

beforeEach(async () => {
  db = await createTestDb();
  apps = service(true);
  [{ id: userId }] = await db
    .insert(user)
    .values({ email: "host@example.com", username: "host", timeZone: "UTC" })
    .returning({ id: user.id });
});

describe("AppsService", () => {
  it("lists apps with whether this instance supports them and what the user installed", async () => {
    await apps.install(userId, "whereby");
    const list = await apps.listApps(userId);
    const bySlug = Object.fromEntries(list.map((app) => [app.slug, app]));
    expect(bySlug.whereby).toMatchObject({
      available: true,
      install: "simple",
      logoUrl: "/app-store/whereby/icon-dark.svg",
    });
    expect(bySlug.whereby.credentialIds).toHaveLength(1);
    expect(bySlug["caldav-calendar"]).toMatchObject({ available: true, credentialIds: [] });
    // Not configured here: no Zoom or Google OAuth client.
    expect(bySlug.zoom.available).toBe(false);
    expect(bySlug["google-calendar"].available).toBe(false);
  });

  it("installs a one-click app once, and refuses apps that need another flow", async () => {
    await apps.install(userId, "jitsi");
    await apps.install(userId, "jitsi");
    expect(await db.select({ type: credential.type }).from(credential)).toEqual([{ type: "jitsi_video" }]);
    await expect(apps.install(userId, "caldav-calendar")).rejects.toMatchObject({ code: "not_found" });
    await expect(apps.install(userId, "nope")).rejects.toMatchObject({ code: "not_found" });
  });

  it("connects CalDAV only with a working login and an http(s) URL", async () => {
    await expect(
      apps.connectCalDav(userId, "caldav-calendar", { url: "ftp://dav.test/dav/", ...FAKE_CALDAV_USER })
    ).rejects.toMatchObject({ code: "invalid_url" });
    await expect(
      apps.connectCalDav(userId, "caldav-calendar", {
        url: "https://dav.test/dav/",
        username: "cal",
        password: "x",
      })
    ).rejects.toMatchObject({ code: "calendar_connection_fail" });
    await apps.connectCalDav(userId, "caldav-calendar", {
      url: "https://dav.test/dav/",
      ...FAKE_CALDAV_USER,
    });
    const [row] = await db
      .select({ type: credential.type, encryptedKey: credential.encryptedKey })
      .from(credential);
    expect(row.type).toBe("caldav_calendar");
    expect(row.encryptedKey).not.toContain("secret");
  });

  it("offers installed conferencing apps plus Cal Video, and keeps a valid default", async () => {
    await apps.install(userId, "whereby");
    const { apps: offered, defaultApp } = await apps.conferencing(userId);
    expect(offered.map((app) => app.slug)).toEqual(["daily-video", "whereby"]);
    expect(defaultApp).toBeNull();

    await expect(
      apps.setDefaultConferencingApp(userId, "whereby", "https://example.com/x")
    ).rejects.toMatchObject({
      code: "invalid_link",
    });
    await apps.setDefaultConferencingApp(userId, "whereby", "https://whereby.com/hana");
    expect((await apps.conferencing(userId)).defaultApp).toEqual({
      appSlug: "whereby",
      appLink: "https://whereby.com/hana",
    });
    expect(await apps.defaultLocation(userId)).toEqual({
      type: "integrations:whereby_video",
      link: "https://whereby.com/hana",
    });
    await expect(apps.setDefaultConferencingApp(userId, "zoom", null)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("forgets the default when its app is removed or the instance stops offering it", async () => {
    await apps.setDefaultConferencingApp(userId, "daily-video", null);
    expect(await apps.defaultLocation(userId)).toEqual({ type: "integrations:daily" });
    expect(await service(false).defaultLocation(userId)).toBeNull();

    await apps.install(userId, "jitsi");
    await apps.setDefaultConferencingApp(userId, "jitsi", null);
    const [{ id }] = await db.select({ id: credential.id }).from(credential);
    await expect(apps.uninstall(userId + 1, id)).rejects.toMatchObject({ code: "not_found" });
    await apps.uninstall(userId, id);
    expect((await apps.conferencing(userId)).defaultApp).toBeNull();
    expect(await db.select().from(credential)).toEqual([]);
  });
});

import type { Page } from "@playwright/test";
import { bookFirstSlot, hasFakes, signUp } from "./support/helpers";
import { FAKE_APPS_PORT } from "./support/ports";
import { expect, newClientContext, test } from "./support/test";

test.skip(!hasFakes, "needs the fake app servers");

const FAKE_APPS = `http://localhost:${FAKE_APPS_PORT}`;

async function setCalDavBusy(page: Page, busy: { start: string; end: string }[]) {
  await page.request.put(`${FAKE_APPS}/control/caldav-busy`, { data: busy });
}

async function addLocation(page: Page, type: string, link?: string) {
  await page.goto("/event-types");
  await page.locator("ul > li").filter({ hasText: "30 min meeting" }).getByRole("link").first().click();
  await page.getByLabel("Add a location").selectOption(type);
  if (link) await page.getByLabel("Meeting URL").fill(link);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toBeVisible();
}

/** The booking page shows the meeting link once the background listeners have run. */
async function expectMeetingLink(guest: Page, name: RegExp) {
  await expect
    .poll(async () => {
      await guest.reload();
      return guest.getByRole("link", { name }).count();
    })
    .toBe(1);
}

test("a CalDAV calendar connected with a login blocks its busy times", async ({ page, browser }) => {
  const { username } = await signUp(page);
  await page.goto("/apps");
  const caldav = page.getByRole("listitem", { name: "CalDAV" });
  await caldav.getByRole("button", { name: "Connect" }).click();
  await caldav.getByLabel("Calendar URL").fill(`${FAKE_APPS}/dav/`);
  await caldav.getByLabel("Username").fill("cal");
  await caldav.getByLabel("Password").fill("wrong");
  await caldav.getByRole("button", { name: "Connect" }).last().click();
  await expect(page.getByRole("alert")).toHaveText("Calendar connection failed");
  await caldav.getByLabel("Password").fill("secret");
  await caldav.getByRole("button", { name: "Connect" }).last().click();
  await expect(caldav.getByRole("button", { name: "Remove app: CalDAV" })).toBeVisible();

  await page.goto("/settings/my-account/calendars");
  await expect(page.getByRole("switch", { name: "Check for conflicts: Work" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Add events to: Work" })).toBeChecked();

  const guest = await (await newClientContext(browser)).newPage();
  const now = new Date();
  // Everything from now until well past next month is busy in the CalDAV calendar.
  await setCalDavBusy(page, [
    { start: now.toISOString(), end: new Date(now.getTime() + 75 * 86_400_000).toISOString() },
  ]);
  try {
    await guest.goto(`/${username}/30min`);
    await guest.getByRole("button", { name: "View next month" }).click();
    await expect(guest.locator("td button:not([disabled])")).toHaveCount(0);
  } finally {
    await setCalDavBusy(page, []);
  }
  await guest.reload();
  await guest.getByRole("button", { name: "View next month" }).click();
  await expect(guest.locator("td button:not([disabled])").first()).toBeVisible();
});

test("Zoom connects through OAuth and gives bookings a Zoom link", async ({ page, browser }) => {
  const { username } = await signUp(page);
  await page.goto("/apps");
  await page.getByRole("listitem", { name: "Zoom Video" }).getByRole("link", { name: "Install" }).click();
  await expect(page).toHaveURL(/\/settings\/my-account\/conferencing$/);
  await expect(page.getByRole("listitem", { name: "Zoom Video" })).toBeVisible();

  await addLocation(page, "integrations:zoom");
  const guest = await (await newClientContext(browser)).newPage();
  await bookFirstSlot(guest, username, "30min");
  await expectMeetingLink(guest, /zoom\.us\/j\//);
});

test("a static-link app puts the host's room on the booking", async ({ page, browser }) => {
  const { username } = await signUp(page);
  await page.goto("/apps");
  const whereby = page.getByRole("listitem", { name: "Whereby" });
  await whereby.getByRole("button", { name: "Install" }).click();
  await expect(whereby.getByRole("button", { name: "Remove app: Whereby" })).toBeVisible();

  await addLocation(page, "integrations:whereby_video", "https://whereby.com/hana-room");
  const guest = await (await newClientContext(browser)).newPage();
  await bookFirstSlot(guest, username, "30min");
  await expect(guest.getByRole("link", { name: /whereby\.com\/hana-room/ })).toBeVisible();

  // The host can move the booking to another room of an installed app.
  await page.goto("/bookings/upcoming");
  const row = page.locator("main ul > li");
  await row.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("menuitem", { name: "Edit location" }).click();
  const newLocation = page.getByRole("combobox", { name: "New location" });
  await expect(newLocation.locator("option", { hasText: "Whereby" })).toHaveCount(1);
  await newLocation.selectOption({ label: "Whereby" });
  await page.getByRole("textbox", { name: "Meeting URL" }).fill("https://example.com/not-whereby");
  await page.getByRole("button", { name: "Update location" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("textbox", { name: "Meeting URL" }).fill("https://whereby.com/other-room");
  await page.getByRole("button", { name: "Update location" }).click();
  await expect(row).toContainText("https://whereby.com/other-room");
});

test("Cal Video can be the default conferencing app", async ({ page }) => {
  await signUp(page);
  await page.goto("/settings/my-account/conferencing");
  const calVideo = page.getByRole("listitem", { name: "Cal Video" });
  await calVideo.getByRole("button", { name: "Set as default" }).click();
  await expect(calVideo.getByText("Default", { exact: true })).toBeVisible();
});

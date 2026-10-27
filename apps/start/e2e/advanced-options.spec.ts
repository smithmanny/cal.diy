import { signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test("custom event names, no cancelling, and a redirect after booking", async ({
  page,
  browser,
  baseURL,
}) => {
  const { username } = await signUp(page);
  await page.goto("/event-types");
  await page.getByRole("link", { name: "30 min meeting" }).first().click();

  await page.getByLabel("Calendar event name").fill("{Scheduler} meets {Organiser}");
  await page.locator("label").filter({ hasText: "Disable Cancelling" }).getByRole("switch").click();
  await page.locator("label").filter({ hasText: "Redirect on booking" }).getByRole("switch").click();
  await page.getByLabel("Redirect URL").fill("not a url");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert")).toHaveText("That doesn't look like a URL");
  await page.getByLabel("Redirect URL").fill(`${baseURL}/auth/login`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await guest.goto(`/${username}/30min`);
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.locator("td button:not([disabled])").first().click();
  await guest.locator("ul li button").first().click();
  await guest.getByLabel("Your name").fill("Greta Guest");
  await guest.getByLabel("Email address").fill("greta@example.com");
  await guest.getByRole("button", { name: "Confirm" }).click();

  await expect(guest).toHaveURL(/\/auth\/login\?/);
  const params = new URL(guest.url()).searchParams;
  expect(params.get("attendeeName")).toBe("Greta Guest");
  expect(params.get("title")).toMatch(/^Greta Guest meets /);

  await guest.goto(`/booking/${params.get("uid")}`);
  await expect(guest.getByText(/^Greta Guest meets /)).toBeVisible();
  await expect(guest.getByRole("link", { name: "Reschedule" })).toBeVisible();
  await expect(guest.getByRole("button", { name: "Cancel" })).toHaveCount(0);
});

test("a locked time zone and a fixed booking page language", async ({ page, browser }) => {
  const { username } = await signUp(page);
  await page.goto("/event-types");
  await page.getByRole("link", { name: "30 min meeting" }).first().click();
  await page
    .locator("label")
    .filter({ hasText: "Lock timezone on booking page" })
    .getByRole("switch")
    .click();
  await page.getByRole("combobox", { name: /^Timezone/ }).selectOption("Asia/Tokyo");
  await page.getByLabel("Interface language").selectOption("de");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  const guest = await (
    await newClientContext(browser, { timezoneId: "America/New_York", locale: "en-US" })
  ).newPage();
  await guest.goto(`/${username}/30min`);
  await expect(guest.getByText("Asia/Tokyo")).toBeVisible();
  await expect(guest.getByRole("combobox")).toHaveCount(0);
  await expect(guest.getByRole("button", { name: "Nächsten Monat anzeigen" })).toBeVisible();
});

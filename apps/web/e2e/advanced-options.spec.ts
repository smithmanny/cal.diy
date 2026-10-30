import { codeFromLatestEmail, hasFakes, signUp, uniqueName } from "./support/helpers";
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

test("bookers pick one of several durations", async ({ page, browser }) => {
  const { username } = await signUp(page);
  await page.goto("/event-types");
  await page.getByRole("link", { name: "30 min meeting" }).first().click();
  await page.locator("label").filter({ hasText: "Allow multiple durations" }).getByRole("switch").click();
  await page.getByRole("checkbox", { name: "15 mins", exact: true }).check();
  await page.getByRole("checkbox", { name: "60 mins", exact: true }).check();
  await page.getByLabel("Default duration").selectOption("30");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await guest.goto(`/${username}/30min`);
  await expect(guest.getByRole("radio", { name: "30 mins" })).toHaveAttribute("aria-checked", "true");
  await guest.getByRole("radio", { name: "15 mins" }).click();
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.locator("td button:not([disabled])").first().click();
  const slot = guest.locator("ul li button").first();
  await slot.click();
  await guest.getByLabel("Your name").fill("Greta Guest");
  await guest.getByLabel("Email address").fill("greta@example.com");
  await guest.getByRole("button", { name: "Confirm" }).click();
  await expect(guest).toHaveURL(/\/booking\//);
  await expect(guest.getByText(/9:00\s?AM - 9:15\s?AM|09:00 - 09:15/)).toBeVisible();
});

test("bookers confirm their email with a code when the host requires it", async ({
  page,
  browser,
  request,
}) => {
  test.skip(!hasFakes, "reads the code from the fake email provider");
  const { username } = await signUp(page);
  await page.goto("/event-types");
  await page.getByRole("link", { name: "30 min meeting" }).first().click();
  await page
    .locator("label")
    .filter({ hasText: "Requires booker email verification" })
    .getByRole("switch")
    .click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  const email = `${uniqueName("booker")}@example.com`;
  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await guest.goto(`/${username}/30min`);
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.locator("td button:not([disabled])").first().click();
  await guest.locator("ul li button").first().click();
  await guest.getByLabel("Your name").fill("Greta Guest");
  await guest.getByLabel("Email address").fill(email);
  await guest.getByRole("button", { name: "Confirm" }).click();
  await expect(guest.getByText("Verification code sent")).toBeVisible();

  await guest.getByLabel("Verification code").fill("000000");
  await guest.getByRole("button", { name: "Confirm" }).click();
  const code = await codeFromLatestEmail(request, email);
  if (code !== "000000") await expect(guest.getByText("Invalid verification code provided")).toBeVisible();
  await guest.getByLabel("Verification code").fill(code);
  await guest.getByRole("button", { name: "Confirm" }).click();
  await expect(guest).toHaveURL(/\/booking\//);
});

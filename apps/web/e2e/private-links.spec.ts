import { signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test("a private link books the event without the username, then expires after its use", async ({
  page,
  browser,
}) => {
  const { username } = await signUp(page);
  await page.goto("/event-types");
  await page.getByRole("link", { name: "30 min meeting" }).first().click();
  await page.locator("label").filter({ hasText: "Private links" }).getByRole("switch").click();
  const url = await page.getByRole("textbox", { name: "Private link", exact: true }).inputValue();
  expect(url).toMatch(/\/d\/[0-9a-f]{32}\/30min$/);
  expect(url).not.toContain(username);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await guest.goto(url);
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.locator("td button:not([disabled])").first().click();
  await guest.locator("ul li button").first().click();
  await guest.getByLabel("Your name").fill("Greta Guest");
  await guest.getByLabel("Email address").fill("greta@example.com");
  await guest.getByRole("button", { name: "Confirm" }).click();
  await expect(guest).toHaveURL(/\/booking\//);

  await guest.goto(url);
  await expect(guest.getByText("This link has expired")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1/1")).toBeVisible();
});

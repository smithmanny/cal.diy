import { signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test("bookers start in the host's default view and can switch between enabled ones", async ({
  page,
  browser,
}) => {
  const { username } = await signUp(page);
  await page.goto("/settings/my-account/appearance");
  await page.getByLabel("Default view").selectOption("week_view");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await guest.goto(`/${username}/30min`);
  await expect(guest.getByRole("radio", { name: "Weekly" })).toHaveAttribute("aria-checked", "true");
  await expect(guest.getByRole("button", { name: "View next week" })).toBeVisible();
  await guest.getByRole("button", { name: "View next week" }).click();
  await guest.locator("section[aria-label] button").first().click();
  await expect(guest.getByLabel("Your name")).toBeVisible();

  await guest.goto(`/${username}/30min?layout=month_view`);
  await expect(guest.getByRole("button", { name: "View next month" })).toBeVisible();

  // An event can override the host's layouts.
  await page.goto("/event-types");
  await page.getByRole("link", { name: "30 min meeting" }).first().click();
  await page
    .locator("label")
    .filter({ hasText: "Use a different layout for this event" })
    .getByRole("switch")
    .click();
  await page.getByRole("checkbox", { name: "Weekly" }).uncheck();
  await page.getByRole("checkbox", { name: "Month" }).uncheck();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await guest.goto(`/${username}/30min`);
  await expect(guest.getByRole("button", { name: "View next week" })).toBeVisible();
  await expect(guest.getByRole("radiogroup", { name: "Layout" })).toHaveCount(0);
});

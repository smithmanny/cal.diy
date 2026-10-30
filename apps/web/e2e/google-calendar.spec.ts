import { bookFirstSlot, hasFakes, signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test.skip(!hasFakes, "needs the fake Google endpoints");

test("connecting Google Calendar and booking a Google Meet event", async ({ page, browser }) => {
  const { username } = await signUp(page);
  await page.goto("/settings/my-account/calendars");
  await page.getByRole("link", { name: "Connect Google Calendar" }).click();
  await expect(page).toHaveURL(/\/settings\/my-account\/calendars$/);
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByRole("switch", { name: "Check for conflicts: My calendar" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Add events to: My calendar" })).toBeChecked();

  await page.goto("/event-types");
  await page.locator("ul > li").filter({ hasText: "30 min meeting" }).getByRole("link").first().click();
  await page.getByLabel("Add a location").selectOption("integrations:google:meet");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  const guest = await (await newClientContext(browser)).newPage();
  await bookFirstSlot(guest, username, "30min");
  await expect
    .poll(async () => {
      await guest.reload();
      return guest.getByRole("link", { name: /meet\.google\.com/ }).count();
    })
    .toBe(1);
});

import { signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test("bookers book a recurring series, hosts see it once and can cancel what remains", async ({
  page,
  browser,
}) => {
  const { username } = await signUp(page);
  await page.goto("/event-types");
  await page.getByRole("link", { name: "30 min meeting" }).first().click();
  await page.locator("label").filter({ hasText: "Recurring event" }).getByRole("switch").click();
  await page.getByRole("spinbutton", { name: "For a maximum of" }).fill("3");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await guest.goto(`/${username}/30min`);
  await expect(guest.getByText("Every week for")).toBeVisible();
  await guest.getByRole("spinbutton", { name: "occurrences" }).fill("2");
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.locator("td button:not([disabled])").first().click();
  await guest.locator("ul li button").first().click();
  await expect(guest.locator("form ul li")).toHaveCount(2);
  await guest.getByLabel("Your name").fill("Greta Guest");
  await guest.getByLabel("Email address").fill("greta@example.com");
  await guest.getByRole("button", { name: "Confirm" }).click();
  await expect(guest).toHaveURL(/\/booking\//);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("The recurring events are scheduled");
  await expect(guest.getByText("Every week for 2 occurrences")).toBeVisible();
  await expect(guest.getByRole("link", { name: "Reschedule" })).toHaveCount(0);

  await page.goto("/bookings/recurring");
  await expect(page.getByText("Every week for 2 occurrences")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("No longer needed"));
  await page.getByRole("button", { name: "Cancel event" }).click();
  await expect(
    page.getByText("As soon as someone books a recurring meeting with you it will show up here.")
  ).toBeVisible();
  await page.goto("/bookings/cancelled");
  await expect(page.locator("ul li")).toHaveCount(2);
});

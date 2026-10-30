import { signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test("a group link books everyone named, as a meeting all members see", async ({ page, browser }) => {
  const first = await signUp(page);
  const secondPage = await (await newClientContext(browser)).newPage();
  const second = await signUp(secondPage);

  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await guest.goto(`/${first.username}+${second.username}`);
  await guest.getByRole("link", { name: /Group meeting/ }).click();
  await expect(guest.getByRole("radio", { name: "30 mins" })).toHaveAttribute("aria-checked", "true");
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.locator("td button:not([disabled])").first().click();
  await guest.locator("ul li button").first().click();
  await guest.getByLabel("Your name").fill("Greta Guest");
  await guest.getByLabel("Email address").fill("greta@example.com");
  await guest.getByRole("button", { name: "Confirm" }).click();
  await expect(guest).toHaveURL(/\/booking\//);
  await expect(guest.getByText(`${second.email}`)).toBeVisible();

  await secondPage.goto("/bookings/upcoming");
  await expect(secondPage.getByRole("link", { name: "Group meeting" })).toBeVisible();
  await expect(secondPage.getByRole("button", { name: "Cancel event" })).toHaveCount(0);
  await page.goto("/bookings/upcoming");
  await expect(page.getByRole("button", { name: "Cancel event" })).toBeVisible();
});

import type { Page } from "@playwright/test";
import { signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

async function takeSeat(page: Page, username: string, name: string, email: string) {
  await page.goto(`/${username}/30min`);
  await page.getByRole("button", { name: "View next month" }).click();
  await page.locator("td button:not([disabled])").first().click();
  await page.locator("ul li button").first().click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/\/booking\/.+seatReferenceUid=/);
}

test("bookers share a seated time until it's full and cancel only their own seat", async ({
  page,
  browser,
}) => {
  const { username } = await signUp(page);
  await page.goto("/event-types");
  await page.getByRole("link", { name: "30 min meeting" }).first().click();
  await page.locator("label").filter({ hasText: "Offer seats" }).getByRole("switch").click();
  await page.getByLabel("Number of seats per booking").fill("2");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  const first = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await takeSeat(first, username, "Ann", "ann@example.com");
  const firstSeatUrl = first.url();

  const second = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await second.goto(`/${username}/30min`);
  await second.getByRole("button", { name: "View next month" }).click();
  await second.locator("td button:not([disabled])").first().click();
  await expect(second.locator("ul li button").first()).toContainText("1 Seat available");
  await takeSeat(second, username, "Bob", "bob@example.com");
  // Attendees aren't shared by default: Bob sees only himself.
  await expect(second.getByText("Bob <bob@example.com>")).toBeVisible();
  await expect(second.getByText("ann@example.com")).toHaveCount(0);
  expect(new URL(second.url()).pathname).toBe(new URL(firstSeatUrl).pathname);

  await first.goto(firstSeatUrl);
  await first.getByRole("button", { name: "Cancel", exact: true }).click();
  await first.getByRole("button", { name: "Cancel event" }).click();
  await expect(first.getByText("Ann <ann@example.com>")).toHaveCount(0);
  await second.reload();
  await expect(second.getByRole("heading", { level: 1 })).toHaveText("This meeting is scheduled");
});

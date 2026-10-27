import process from "node:process";
import { moveBookingToPast } from "./support/db";
import { bookFirstSlot, signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test.skip(Boolean(process.env.E2E_BASE_URL), "moves a booking into the past in the dev server's database");

test("hosts filter their bookings and mark attendees who didn't show up", async ({ browser, page }) => {
  const { username } = await signUp(page);
  const guest = await (await newClientContext(browser)).newPage();
  const { uid: pastUid } = await bookFirstSlot(guest, username, "30min", {
    name: "Ada",
    email: "ada@example.com",
  });
  await moveBookingToPast(pastUid);
  await bookFirstSlot(guest, username, "30min", { name: "Bob", email: "bob@example.com" });
  await bookFirstSlot(guest, username, "15min", { name: "Cleo", email: "cleo@example.com" });

  const rows = page.locator("main ul > li");
  await page.goto("/bookings/upcoming");
  await expect(rows).toHaveCount(2);
  await page.getByRole("searchbox", { name: "Name or email" }).fill("CLEO@");
  await page.getByRole("searchbox", { name: "Name or email" }).press("Enter");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("cleo@example.com");
  await expect(page).toHaveURL(/attendee=CLEO%40/);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(2);
  await page.getByRole("combobox", { name: "Event type" }).selectOption({ label: "30 min meeting" });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("bob@example.com");

  // Filters carry over between tabs; the past booking is a 30-minute one too.
  await page.getByRole("link", { name: "Past" }).click();
  await expect(rows).toHaveCount(1);
  await rows.getByRole("button", { name: "Mark as no-show: ada@example.com" }).click();
  await expect(rows.getByText("No-show", { exact: true })).toBeVisible();
  await rows.getByRole("button", { name: "Unmark no-show: ada@example.com" }).click();
  await expect(rows.getByText("No-show", { exact: true })).toHaveCount(0);

  // Upcoming bookings can't have no-shows yet.
  await page.getByRole("link", { name: "Upcoming" }).click();
  await expect(rows.getByRole("button", { name: /no-show/ })).toHaveCount(0);
});

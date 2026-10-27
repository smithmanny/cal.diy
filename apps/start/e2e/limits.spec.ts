import type { Page } from "@playwright/test";
import { bookFirstSlot, signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

async function openEventType(page: Page, title: string) {
  await page.goto("/event-types");
  await page.getByRole("link", { name: title }).first().click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

function toggle(page: Page, title: string) {
  return page.locator("label").filter({ hasText: title }).getByRole("switch");
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
}

test("a daily booking limit closes the day once it is reached", async ({ page, browser }) => {
  const { username } = await signUp(page);
  await openEventType(page, "30 min meeting");
  await toggle(page, "Limit booking frequency").click();
  await expect(page.getByRole("spinbutton", { name: "Per day" })).toHaveValue("1");
  await save(page);

  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  const { date } = await bookFirstSlot(guest, username, "30min");
  await guest.goto(`/${username}/30min`);
  await guest.getByRole("button", { name: "View next month" }).click();
  await expect(guest.getByRole("button", { name: date })).toBeDisabled();
});

test("limits must grow with the period", async ({ page }) => {
  await signUp(page);
  await openEventType(page, "30 min meeting");
  await toggle(page, "Limit booking frequency").click();
  await page.getByRole("spinbutton", { name: "Per day" }).fill("5");
  await page.getByRole("button", { name: "Add limit" }).click();
  await page.getByRole("spinbutton", { name: "Per week" }).fill("2");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Booking limits must be in ascending order. [day, week, month, year]"
  );
});

test("one upcoming booking per booker, with an offer to move it", async ({ page, browser }) => {
  const { username } = await signUp(page);
  await openEventType(page, "30 min meeting");
  await toggle(page, "Limit number of upcoming bookings per booker").click();
  await toggle(page, "Offer to reschedule the last booking to the new time slot").click();
  await save(page);

  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  const first = await bookFirstSlot(guest, username, "30min");
  await guest.goto(`/${username}/30min`);
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.getByRole("button", { name: first.date }).click();
  await guest.locator("ul li button").nth(2).click();
  await guest.getByLabel("Your name").fill("Greta Guest");
  await guest.getByLabel("Email address").fill("greta@example.com");
  await guest.getByRole("button", { name: "Confirm" }).click();
  await expect(guest.getByRole("alert")).toContainText("You already have a booking for this event on");
  await guest.getByRole("alert").getByRole("button", { name: "Reschedule" }).click();
  await expect(guest).toHaveURL(/\/booking\//);
  expect(guest.url()).not.toContain(first.uid);

  await guest.goto(`/booking/${first.uid}`);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("Booking rescheduled");
});

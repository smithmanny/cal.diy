import { expect, test } from "@playwright/test";
import { bookFirstSlot, signUp } from "./support/helpers";

test("a guest in another time zone books, the slot disappears, then reschedules and cancels", async ({
  browser,
}) => {
  const hostContext = await browser.newContext({ timezoneId: "America/New_York" });
  const { username } = await signUp(await hostContext.newPage());

  const guestContext = await browser.newContext({ timezoneId: "Europe/Berlin", locale: "en-GB" });
  const guest = await guestContext.newPage();
  await guest.goto(`/${username}`);
  await expect(guest.locator("main li")).toHaveCount(2);

  const booked = await bookFirstSlot(guest, username, "30min");
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("This meeting is scheduled");
  // 9:00 in New York is 15:00 in Berlin (both in standard time in November).
  await expect(guest.locator("dl")).toContainText("(Europe/Berlin)");

  const other = await guestContext.newPage();
  await other.goto(`/${username}/30min`);
  await other.getByRole("button", { name: "View next month" }).click();
  await other.locator(`td button[aria-label="${booked.date}"]`).click();
  await expect(other.locator("ul li button").first()).toBeVisible();
  await expect(other.locator("ul li button", { hasText: booked.time })).toHaveCount(0);

  await guest.getByRole("link", { name: "Reschedule" }).click();
  await expect(guest.getByText("Reschedule booking")).toBeVisible();
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.locator(`td button[aria-label="${booked.date}"]`).click();
  await guest.locator("ul li button").nth(2).click();
  await guest.getByLabel("Your name").fill("Greta Guest");
  await guest.getByLabel("Email address").fill("greta@example.com");
  await guest.getByRole("button", { name: "Confirm" }).click();
  await expect(guest).not.toHaveURL(new RegExp(booked.uid));
  const newUid = guest.url().split("/booking/")[1];

  await guest.goto(`/booking/${booked.uid}`);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("Booking rescheduled");

  await guest.goto(`/booking/${newUid}`);
  await guest.getByRole("button", { name: "Cancel", exact: true }).click();
  await guest.getByPlaceholder("Why are you cancelling?").fill("Plans changed");
  await guest.getByRole("button", { name: "Cancel event" }).click();
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("This event is canceled");
  await expect(guest.locator("dl")).toContainText("Plans changed");
});

import { bookFirstSlot, signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test("Cal's older links still land on the right pages", async ({ page, browser }) => {
  const { username } = await signUp(page);
  const guest = await (await newClientContext(browser)).newPage();
  const { uid } = await bookFirstSlot(guest, username, "30min");

  await guest.goto(`/reschedule/${uid}?embed=ns`);
  await expect(guest).toHaveURL(new RegExp(`/${username}/30min\\?embed=ns&rescheduleUid=${uid}$`));
  await expect(guest.getByText("Reschedule booking")).toBeVisible();

  await guest.goto(`/booking-successful/${uid}`);
  await expect(guest).toHaveURL(new RegExp(`/booking/${uid}$`));
  await guest.goto(`/booking/${uid}/embed?embed=ns`);
  await expect(guest).toHaveURL(new RegExp(`/booking/${uid}\\?embed=ns$`));

  // The organizer's full-page history of the booking.
  await page.goto(`/booking/${uid}/logs`);
  await expect(page.getByRole("heading", { name: "Booking history" })).toBeVisible();
  await expect(page.locator("ol > li").first()).toContainText("Booked with");

  await page.goto("/more");
  await expect(page.getByRole("link", { name: "Push notifications" })).toBeVisible();

  await page.goto("/auth/logout");
  await expect(page.getByRole("heading", { name: "You've been logged out" })).toBeVisible();
  await page.goto("/event-types");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("unknown pages get the 404 page", async ({ page }) => {
  await page.goto("/nowhere/at/all");
  await expect(page.getByRole("heading", { name: "This page does not exist." })).toBeVisible();
  await page.goto("/auth/signin?callbackUrl=%2Fbookings%2Fupcoming");
  await expect(page).toHaveURL(/\/auth\/login\?callbackUrl=%2Fbookings%2Fupcoming$/);
});

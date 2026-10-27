import process from "node:process";
import { moveBookingToPast } from "./support/db";
import { bookFirstSlot, linkFromLatestEmail, signUp, uniqueName } from "./support/helpers";
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

test("hosts move a booking, add guests and ask the attendee to pick a new time", async ({
  browser,
  page,
  request,
}) => {
  const { username } = await signUp(page);
  const guest = await (await newClientContext(browser)).newPage();
  const ada = `${uniqueName("ada")}@example.com`;
  const nina = `${uniqueName("nina")}@example.com`;
  await bookFirstSlot(guest, username, "30min", { name: "Ada", email: ada });

  const row = page.locator("main ul > li");
  const edit = async (item: string) => {
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("menuitem", { name: item }).click();
  };
  await page.goto("/bookings/upcoming");

  await edit("Edit location");
  await page.getByRole("combobox", { name: "New location" }).selectOption({ label: "Link meeting" });
  await page.getByRole("textbox", { name: "Link meeting" }).fill("https://meet.example/room");
  await page.getByRole("button", { name: "Update location" }).click();
  await expect(row).toContainText("https://meet.example/room");
  await linkFromLatestEmail(request, ada, /^Location Changed/);

  await edit("Add guests");
  await page.getByRole("textbox", { name: "Guest email" }).fill(nina);
  await page.getByRole("button", { name: "Add emails" }).click();
  await expect(row).toContainText(nina);
  await linkFromLatestEmail(request, nina, /^Confirmed/);
  await linkFromLatestEmail(request, ada, /^Guests Added/);

  await edit("Request reschedule");
  await page.getByRole("textbox", { name: "Reason for reschedule request" }).fill("Something came up");
  await page.getByRole("button", { name: "Request reschedule" }).click();
  await expect(
    page.getByText("As soon as someone books a time with you it will show up here.")
  ).toBeVisible();

  // The attendee books a new time from the email, and the booking is live again.
  const rebook = await linkFromLatestEmail(request, ada, /^Action Required Reschedule/);
  expect(rebook).toContain(`/${username}/30min?rescheduleUid=`);
  const pickNewTime = async () => {
    await guest.goto(rebook);
    await expect(guest.getByText("Reschedule booking")).toBeVisible();
    await guest.getByRole("button", { name: "View next month" }).click();
    await guest.locator("td button:not([disabled])").nth(1).click();
    await guest.locator("ul li button").first().click();
    await guest.getByLabel("Your name").fill("Ada");
    await guest.getByLabel("Email address").fill(ada);
    await guest.getByRole("button", { name: "Confirm" }).click();
  };
  await pickNewTime();
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("This meeting is scheduled");
  await page.reload();
  await expect(row).toHaveCount(1);

  // The request can be answered once.
  await pickNewTime();
  await expect(guest.getByText("This event is canceled")).toBeVisible();
});

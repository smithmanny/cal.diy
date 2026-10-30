import { hasFakes, signUp } from "./support/helpers";
import { FAKE_STRIPE_PORT } from "./support/ports";
import { expect, newClientContext, test } from "./support/test";

test.skip(!hasFakes, "needs the fake Stripe");

test("a paid event takes the booker through Stripe Checkout and refunds a cancellation", async ({
  page,
  browser,
  request,
}) => {
  const { username } = await signUp(page);
  await page.goto("/apps");
  await page.getByRole("listitem", { name: "Stripe" }).getByRole("link", { name: "Install" }).click();
  await expect(page).toHaveURL(/\/apps$/);
  await expect(page.getByRole("button", { name: "Remove app: Stripe" })).toBeVisible();

  await page.goto("/event-types");
  await page.locator("ul > li").filter({ hasText: "30 min meeting" }).getByRole("link").first().click();
  await page.getByText("Require payment", { exact: true }).click();
  await page.getByLabel("Price").fill("15.50");
  await page.getByLabel("Refund policy").selectOption("always");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await guest.goto(`/${username}/30min`);
  await expect(guest.getByText("$15.50")).toBeVisible();
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.locator("td button:not([disabled])").first().click();
  await guest.locator("ul li button").first().click();
  await guest.getByLabel("Your name").fill("Pat Payer");
  await guest.getByLabel("Email address").fill("pat@example.com");
  await guest.getByRole("button", { name: "Confirm" }).click();

  await expect(guest).toHaveURL(/\/payment\//);
  await expect(guest.getByRole("heading", { name: "Complete your booking" })).toBeVisible();
  await guest.getByRole("button", { name: "Pay now" }).click();
  await expect(guest.getByRole("heading", { name: "Pay 15.50 USD" })).toBeVisible();
  await guest.getByRole("button", { name: "Pay" }).click();
  await expect(guest).toHaveURL(/\/booking\//);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("This meeting is scheduled");

  await guest.getByRole("button", { name: "Cancel", exact: true }).click();
  await guest.getByPlaceholder("Why are you cancelling?").fill("Can't make it");
  await guest.getByRole("button", { name: "Cancel event" }).click();
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("This event is canceled");
  await expect
    .poll(
      async () =>
        (await (await request.get(`http://localhost:${FAKE_STRIPE_PORT}/control/refunds`)).json()).length
    )
    .toBeGreaterThan(0);
});

import { expect, test } from "@playwright/test";
import { WEBHOOK_SECRET } from "./support/fake-servers";
import { WEBHOOK_RECEIVER_PORT } from "./support/global-setup";
import { bookFirstSlot, hasFakes, signUp } from "./support/helpers";

test.skip(!hasFakes, "needs the local webhook receiver");

test("webhooks get signed BOOKING_CREATED and BOOKING_CANCELLED deliveries", async ({
  page,
  browser,
  request,
}) => {
  const { username } = await signUp(page);
  await page.goto("/settings/developer/webhooks");
  await page.getByRole("button", { name: "New webhook" }).click();
  await page.getByPlaceholder("https://").fill(`http://localhost:${WEBHOOK_RECEIVER_PORT}/${username}`);
  await page.locator('input[type="password"]').fill(WEBHOOK_SECRET);
  await page.getByRole("button", { name: "Ping test" }).click();
  await expect(page.getByRole("status")).toHaveText("Test passed!");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("ul > li")).toContainText(String(WEBHOOK_RECEIVER_PORT));

  const guest = await (await browser.newContext()).newPage();
  const { uid } = await bookFirstSlot(guest, username, "30min");
  await guest.getByRole("button", { name: "Cancel", exact: true }).click();
  await guest.getByRole("button", { name: "Cancel event" }).click();
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("This event is canceled");

  await expect
    .poll(async () => {
      const received = await (await request.get(`http://localhost:${WEBHOOK_RECEIVER_PORT}/received`)).json();
      return received
        .filter((hook: { uid?: string }) => hook.uid === uid)
        .map(
          (hook: { trigger: string; signatureValid: boolean }) => `${hook.trigger}:${hook.signatureValid}`
        );
    })
    .toEqual(["BOOKING_CREATED:true", "BOOKING_CANCELLED:true"]);
});

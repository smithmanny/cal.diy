import { expect, test } from "@playwright/test";
import { bookFirstSlot, signUp } from "./support/helpers";

test("hosts confirm requested bookings and cancel upcoming ones", async ({ browser }) => {
  const host = await (await browser.newContext({ timezoneId: "America/New_York" })).newPage();
  host.on("dialog", (dialog) => dialog.accept(dialog.type() === "prompt" ? "Out sick" : undefined));
  const { username } = await signUp(host);
  await host.locator("ul > li").filter({ hasText: "30 min meeting" }).getByRole("link").first().click();
  await host.locator("label").filter({ hasText: "Requires confirmation" }).getByRole("switch").click();
  await host.getByRole("button", { name: "Save" }).click();
  await expect(host.getByRole("status")).toBeVisible();

  const guest = await (await browser.newContext()).newPage();
  await bookFirstSlot(guest, username, "30min");
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("Your booking has been submitted");
  await bookFirstSlot(guest, username, "15min");

  await host.goto("/bookings/unconfirmed");
  await expect(host.locator("ul > li")).toHaveCount(1);
  await host.locator("ul > li").getByRole("button", { name: "Accept" }).click();
  await expect(host.getByText("Your unconfirmed bookings will show up here.")).toBeVisible();

  await host.getByRole("link", { name: "Upcoming" }).click();
  await expect(host.locator("ul > li")).toHaveCount(2);
  await host.locator("ul > li").first().getByRole("button", { name: "Cancel event" }).click();
  await expect(host.locator("ul > li")).toHaveCount(1);
  await host.getByRole("link", { name: "Canceled" }).click();
  await expect(host.locator("ul > li")).toHaveCount(1);
});

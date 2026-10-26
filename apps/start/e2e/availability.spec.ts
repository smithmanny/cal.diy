import { expect, test } from "@playwright/test";
import { signUp } from "./support/helpers";

test.use({ timezoneId: "America/New_York" });

test("new users get a default schedule they can edit, override, and replace", async ({ page }) => {
  await signUp(page);
  await page.getByRole("link", { name: "Availability" }).click();
  const workingHours = page.locator("li").filter({ hasText: "Working hours" });
  await expect(workingHours).toContainText("Default");
  await expect(workingHours).toContainText("Mon - Fri, 9:00 AM - 5:00 PM");
  await expect(workingHours).toContainText("America/New_York");

  await workingHours.click();
  const saturday = page.locator("li").filter({ hasText: "Saturday" });
  await saturday.getByRole("switch").click();
  await saturday.getByLabel("Start time").selectOption("10:00");
  await saturday.getByLabel("End time").selectOption("14:00");
  await page.getByLabel("Date", { exact: true }).fill("2030-12-25");
  await page.getByRole("button", { name: "Add an override" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.reload();
  await expect(page.locator("li").filter({ hasText: "Saturday" }).getByLabel("Start time")).toHaveValue(
    "10:00"
  );
  await expect(page.getByText("Wednesday, December 25, 2030")).toBeVisible();

  await page.locator("li").filter({ hasText: "Monday" }).getByLabel("Start time").selectOption("18:00");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid time on Monday");
});

test("a second schedule can become the default, and only non-defaults can be deleted", async ({ page }) => {
  await signUp(page);
  await page.goto("/availability");
  await page.getByRole("button", { name: "New schedule" }).click();
  await page.getByLabel("Name").fill("Evenings");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Evenings" })).toBeVisible();
  await page.getByRole("button", { name: "Set as default" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  await page.goto("/availability");
  await expect(page.locator("li").filter({ hasText: "Evenings" })).toContainText("Default");
  await page.locator("li").filter({ hasText: "Working hours" }).click();
  await page.getByRole("button", { name: "Delete schedule" }).click();
  await expect(page).toHaveURL(/\/availability$/);
  await expect(page.locator("ul > li")).toHaveCount(1);
});

import process from "node:process";
import { makeAdmin } from "./support/db";
import { PASSWORD, signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test.skip(Boolean(process.env.E2E_BASE_URL), "makes an admin in the dev server's database");

test("admins find, edit, lock and impersonate users", async ({ browser, page }) => {
  const admin = await signUp(page);
  await makeAdmin(admin.email);
  const memberPage = await (await newClientContext(browser)).newPage();
  const member = await signUp(memberPage);

  // Members don't get the admin pages at all.
  await memberPage.goto("/settings/admin/users");
  await expect(memberPage.getByRole("heading", { name: "This page does not exist." })).toBeVisible();

  const rows = page.locator("main ul > li");
  await page.goto("/settings/admin/users");
  await page.getByRole("searchbox", { name: "Name or email" }).fill(member.username);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(member.email);

  await rows.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Full name").fill("Renamed Member");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.getByRole("link", { name: "Go back" }).click();
  await page.getByRole("searchbox", { name: "Name or email" }).fill(member.username);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(rows).toContainText("Renamed Member");

  await rows.getByRole("button", { name: "Lock user" }).click();
  await expect(page.getByText("User has been locked.")).toBeVisible();
  await expect(rows).toContainText("Locked");
  const lockedPage = await (await newClientContext(browser)).newPage();
  await lockedPage.goto("/auth/login");
  await lockedPage.getByLabel("Email address").fill(member.email);
  await lockedPage.getByLabel("Password").fill(PASSWORD);
  await lockedPage.getByRole("button", { name: "Sign in" }).click();
  await expect(lockedPage.getByText("Your account has been locked.")).toBeVisible();
  await rows.getByRole("button", { name: "Unlock user" }).click();
  await expect(page.getByText("User has been unlocked.")).toBeVisible();

  await rows.getByRole("button", { name: "Impersonate" }).click();
  await expect(page).toHaveURL(/\/event-types$/);
  await expect(
    page.getByRole("status").filter({ hasText: `You are signed in as ${member.username}` })
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop impersonating" }).click();
  await expect(page).toHaveURL(/\/settings\/admin\/users$/);
  await expect(page.getByText("You are signed in as")).toHaveCount(0);
});

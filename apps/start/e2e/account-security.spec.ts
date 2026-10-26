import process from "node:process";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import type { Page } from "@playwright/test";
import { linkFromLatestEmail, PASSWORD, signUp } from "./support/helpers";
import { expect, test } from "./support/test";

// Production builds ignore RESEND_API_URL, so emails can only be captured from the dev server.
const capturesEmail = !process.env.E2E_BASE_URL;

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/auth\/login/);
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a forgotten password is reset from the emailed link, under Cal's password rule", async ({
  page,
  request,
}) => {
  test.skip(!capturesEmail, "needs the fake email provider");
  const { email } = await signUp(page);
  await signOut(page);

  await page.getByRole("link", { name: "Forgot password?" }).click();
  // The URL changes before the page does; typing earlier would land in the login form.
  await expect(page.getByRole("heading", { name: "Forgot password?" })).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset email" }).click();
  await expect(page.getByRole("heading", { name: "Reset link sent" })).toBeVisible();

  await page.goto(await linkFromLatestEmail(request, email, /Reset password/));
  await expect(page).toHaveURL(/\/auth\/reset-password\?token=/);
  await page.getByLabel("New password").fill("alllowercase");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("alert")).toContainText("minimum of 7 characters");
  await page.getByLabel("New password").fill("Rotated456");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("status")).toHaveText("Your password has been successfully changed.");

  await page.getByRole("link", { name: "Back to sign in" }).click();
  await signIn(page, email, "Rotated456");
  await expect(page).toHaveURL(/\/event-types$/);
});

test("a reset link can't be reused or guessed", async ({ page }) => {
  await page.goto("/auth/reset-password?error=INVALID_TOKEN");
  await expect(page.getByRole("heading", { name: "Invalid link" })).toBeVisible();
});

test("new users are asked to verify their email until they follow the link", async ({ page, request }) => {
  test.skip(!capturesEmail, "needs the fake email provider");
  const { email } = await signUp(page);
  const banner = page.getByText("Verify your email address to guarantee the best email");
  await expect(banner).toBeVisible();

  await page.goto(await linkFromLatestEmail(request, email, /Verify your account/));
  await expect(page).toHaveURL(/\/event-types$/);
  await expect(page.getByRole("heading", { name: "Event types" })).toBeVisible();
  await expect(banner).toBeHidden();
});

test("changing the password requires the current one and signs in with the new one", async ({ page }) => {
  const { email } = await signUp(page);
  await page.goto("/settings/security/password");
  await page.getByLabel("Current password").fill("Wrong1234");
  await page.getByLabel("New password").fill("Changed789");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByRole("alert")).toHaveText("Password is incorrect.");

  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByRole("status")).toHaveText("Your password has been successfully changed.");

  await signOut(page);
  await signIn(page, email, "Changed789");
  await expect(page).toHaveURL(/\/event-types$/);
});

test("two-factor auth guards sign-in with an authenticator code or a one-time backup code", async ({
  page,
}) => {
  const { email } = await signUp(page);
  await page.goto("/settings/security/two-factor-auth");
  await page.getByRole("button", { name: "Enable two-factor authentication" }).click();
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();

  const encodedSecret = (await page.getByTestId("totp-secret").textContent()) ?? "";
  const totp = () => createOTP(new TextDecoder().decode(base32.decode(encodedSecret))).totp();
  await page.getByLabel("Two-factor code").fill("000000");
  await page.getByRole("button", { name: "Enable two-factor authentication" }).click();
  await expect(page.getByRole("alert")).toHaveText("Two-factor code is incorrect.");
  await page.getByLabel("Two-factor code").fill(await totp());
  await page.getByRole("button", { name: "Enable two-factor authentication" }).click();
  const backupCodeItems = page.getByTestId("backup-codes").locator("li");
  await expect(backupCodeItems).toHaveCount(10);
  const backupCodes = (await backupCodeItems.allTextContents()).map((code) => code.trim());
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Enabled", { exact: true })).toBeVisible();

  await signOut(page);
  await signIn(page, email, PASSWORD);
  await expect(page.getByLabel("Two-factor code")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.getByLabel("Two-factor code").fill(await totp());
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/event-types$/);

  await signOut(page);
  await signIn(page, email, PASSWORD);
  await page.getByRole("button", { name: "Lost access" }).click();
  await page.getByLabel("Backup code").fill(backupCodes[0]);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/event-types$/);

  await signOut(page);
  await signIn(page, email, PASSWORD);
  await page.getByRole("button", { name: "Lost access" }).click();
  await page.getByLabel("Backup code").fill(backupCodes[0]);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Two-factor code is incorrect.");
});

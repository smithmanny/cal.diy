import process from "node:process";
import { type APIRequestContext, expect, type Page } from "@playwright/test";
import type { CapturedEmail } from "./fake-servers";
import { FAKE_RESEND_PORT } from "./global-setup";

export const PASSWORD = "Secret123";

/**
 * The fake Google and webhook receiver always run on localhost, but an external server only uses
 * them if it was started with the fake Google URLs; E2E_FAKES=1 says it was.
 */
export const hasFakes = !process.env.E2E_BASE_URL || process.env.E2E_FAKES === "1";

export function uniqueName(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export async function signUp(
  page: Page,
  username = uniqueName("user")
): Promise<{ username: string; email: string }> {
  const email = `${username}@example.com`;
  await page.goto("/auth/signup");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/event-types$/);
  await expect(page.getByRole("heading", { name: "Event types" })).toBeVisible();
  return { username, email };
}

/** Books the first free slot next month (always beyond minimum notice) and returns the booking uid. */
export async function bookFirstSlot(
  page: Page,
  username: string,
  slug: string,
  guest = { name: "Greta Guest", email: "greta@example.com" }
) {
  await page.goto(`/${username}/${slug}`);
  await page.getByRole("button", { name: "View next month" }).click();
  const day = page.locator("td button:not([disabled])").first();
  const date = await day.getAttribute("aria-label");
  await day.click();
  const slot = page.locator("ul li button").first();
  const time = await slot.innerText();
  await slot.click();
  await page.getByLabel("Your name").fill(guest.name);
  await page.getByLabel("Email address").fill(guest.email);
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/\/booking\//);
  await expect(page.getByRole("heading", { level: 1, name: /scheduled|submitted/i })).toBeVisible();
  return { uid: page.url().split("/booking/")[1], date: date ?? "", time };
}

/** The first link in the newest email to `to` whose subject matches, from the fake Resend. */
export async function linkFromLatestEmail(
  request: APIRequestContext,
  to: string,
  subject: RegExp
): Promise<string> {
  let link = "";
  await expect
    .poll(async () => {
      const emails: CapturedEmail[] = await (
        await request.get(`http://localhost:${FAKE_RESEND_PORT}/emails?to=${encodeURIComponent(to)}`)
      ).json();
      const email = emails.filter((candidate) => subject.test(candidate.subject)).at(-1);
      link = email?.html.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&") ?? "";
      return link;
    })
    .not.toBe("");
  return link;
}

import type { APIRequestContext, Page } from "@playwright/test";
import { linkFromLatestEmail, signUp, uniqueName } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test("owners create a team, invite by email, and manage what members can do", async ({
  browser,
  page,
  request,
}) => {
  await signUp(page);
  const slug = uniqueName("sales");
  await page.goto("/teams");
  await page.getByRole("link", { name: "New team" }).click();
  await expect(page.getByRole("heading", { name: "Create a new team" })).toBeVisible();
  await page.getByLabel("Team name").fill("Sales");
  await page.getByLabel("Team URL").fill(slug);
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByRole("heading", { name: "Sales" })).toBeVisible();

  const member = await (await newClientContext(browser)).newPage();
  const { email, username: memberUsername } = await signUp(member);
  await page.getByLabel("Invitee email").fill(email);
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByRole("status")).toHaveText("Invitation sent");
  await expect(page.getByText(email)).toBeVisible();

  // The invitee confirms their email first, then accepts from the invitation email.
  const invitation = await linkFromLatestEmail(request, email, /invited you to join the team Sales/);
  await member.goto(invitation);
  await member.getByRole("button", { name: "Accept invitation" }).click();
  await expect(member.getByText("Verify your email address before joining a team")).toBeVisible();
  await member.goto(await linkFromLatestEmail(request, email, /Verify your account/));
  await member.goto(invitation);
  await member.getByRole("button", { name: "Accept invitation" }).click();
  await expect(member.getByRole("heading", { name: "Sales" })).toBeVisible();
  // Members see the team but can't change it or invite others.
  await expect(member.getByLabel("Team name")).toBeDisabled();
  await expect(member.getByLabel("Invitee email")).toHaveCount(0);

  await page.reload();
  // The role saves without a message, so wait for the save before the member looks again.
  const saved = page.waitForResponse((response) => response.url().includes("/_serverFn/"));
  await page.getByLabel(`Role: ${email}`).selectOption({ label: "Admin" });
  await saved;
  await member.reload();
  await expect(member.getByLabel("Invitee email")).toBeVisible();

  await page.getByRole("button", { name: `Remove member: ${email}` }).click();
  await member.goto("/teams");
  await expect(member.getByText("You don't have any teams yet.")).toBeVisible();
});

test("organizations hold teams created by those who manage them", async ({ page }) => {
  await signUp(page);
  await page.goto("/teams/new");
  await page.getByLabel("Team name").fill("Acme");
  await page.getByLabel("Team URL").fill(uniqueName("acme"));
  await page.getByText("This is an organization with its own teams").click();
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("heading", { name: "Acme" })).toBeVisible();

  await page.getByRole("link", { name: "New team" }).click();
  // The organization's page has its own "Team name" field, so wait for the new team form.
  await expect(page.getByRole("heading", { name: "Create a new team" })).toBeVisible();
  await page.getByLabel("Team name").fill("Support");
  await page.getByLabel("Team URL").fill(uniqueName("support"));
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByText("Part of Acme")).toBeVisible();
  await page.goto("/teams");
  await expect(page.locator("main ul > li")).toHaveCount(2);
});

/** An owner's team with a second member who accepted the emailed invitation. */
async function teamWithMember(page: Page, member: Page, request: APIRequestContext) {
  const owner = await signUp(page);
  const slug = uniqueName("crew");
  await page.goto("/teams/new");
  await page.getByLabel("Team name").fill("Crew");
  await page.getByLabel("Team URL").fill(slug);
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByRole("heading", { name: "Crew" })).toBeVisible();
  const { email, username: memberUsername } = await signUp(member);
  await page.getByLabel("Invitee email").fill(email);
  await page.getByRole("button", { name: "Invite" }).click();
  await member.goto(await linkFromLatestEmail(request, email, /Verify your account/));
  await member.goto(await linkFromLatestEmail(request, email, /invited you to join the team Crew/));
  await member.getByRole("button", { name: "Accept invitation" }).click();
  await expect(member.getByRole("heading", { name: "Crew" })).toBeVisible();
  return { slug, memberEmail: email, memberUsername, ownerUsername: owner.username };
}

async function createTeamEventType(page: Page, title: string, kind: "Collective" | "Round robin") {
  await page.goto("/event-types");
  const section = page.getByRole("region", { name: "Crew" });
  await section.getByRole("button", { name: "New team event type" }).click();
  await section.getByLabel("Title").fill(title);
  await section.getByLabel("Scheduling type").selectOption({ label: kind });
  await section.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Assignment" })).toBeVisible();
}

async function bookTeamSlot(guest: Page, path: string, email: string, nth = 0) {
  await guest.goto(path);
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.locator("td button:not([disabled])").first().click();
  await guest.locator("ul li button").nth(nth).click();
  await guest.getByLabel("Your name").fill("Gail Guest");
  await guest.getByLabel("Email address").fill(email);
  await guest.getByRole("button", { name: "Confirm" }).click();
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("This meeting is scheduled");
}

test("teams take bookings together (collective) or in turn (round robin)", async ({
  browser,
  page,
  request,
}) => {
  const member = await (await newClientContext(browser)).newPage();
  const { slug } = await teamWithMember(page, member, request);
  const guest = await (await newClientContext(browser)).newPage();

  await createTeamEventType(page, "Panel", "Collective");
  await guest.goto(`/team/${slug}`);
  await expect(guest.getByRole("heading", { name: "Crew" })).toBeVisible();
  await guest.getByRole("link", { name: /Panel/ }).click();
  await expect(guest).toHaveURL(new RegExp(`/team/${slug}/panel`));
  await bookTeamSlot(guest, `/team/${slug}/panel`, "gail@example.com");
  // Both members are on a collective booking.
  for (const host of [page, member]) {
    await host.goto("/bookings/upcoming");
    await expect(host.locator("main ul > li").filter({ hasText: "Panel" })).toHaveCount(1);
  }

  await createTeamEventType(page, "Demo", "Round robin");
  await bookTeamSlot(guest, `/team/${slug}/demo`, "one@example.com", 2);
  await bookTeamSlot(guest, `/team/${slug}/demo`, "two@example.com", 4);
  // Round robin hands the two bookings to different members.
  for (const host of [page, member]) {
    await host.goto("/bookings/upcoming");
    await expect(host.locator("main ul > li").filter({ hasText: "Demo" })).toHaveCount(1);
  }
});

test("members who are out of office send bookers to a teammate", async ({ browser, page, request }) => {
  const member = await (await newClientContext(browser)).newPage();
  const { memberUsername, ownerUsername } = await teamWithMember(page, member, request);
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0)).toISOString().slice(0, 10);
  await member.goto("/settings/my-account/out-of-office");
  await member.getByRole("button", { name: "Go Out of Office" }).click();
  await member.getByLabel("Date", { exact: true }).fill(start);
  await member.getByLabel("To", { exact: true }).fill(end);
  await member.getByLabel("Provide a link to a team member when OOO").selectOption({ label: ownerUsername });
  await member.getByRole("button", { name: "Save" }).click();
  await expect(member.getByRole("status")).toHaveText("Successfully created a new entry");

  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await guest.goto(`/${memberUsername}/30min`);
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.locator("td button:not([disabled])").first().click();
  await guest.getByRole("link", { name: `Book ${ownerUsername}` }).click();
  await expect(guest).toHaveURL(new RegExp(`/${ownerUsername}$`));
});

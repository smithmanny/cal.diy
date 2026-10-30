import { PASSWORD, uniqueName } from "./support/helpers";
import { expect, test } from "./support/test";

// A 1×1 red PNG; the browser scales it to Cal's avatar size before upload.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64"
);

test("new accounts go through onboarding before using the app, once", async ({ page }) => {
  const username = uniqueName("onboard");
  const chosen = uniqueName("chosen");
  await page.goto("/auth/signup");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email address").fill(`${username}@example.com`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/getting-started\/user-settings$/);

  // Other pages send the user back until onboarding is done.
  await page.goto("/bookings/upcoming");
  await expect(page).toHaveURL(/\/getting-started\/user-settings$/);

  await page.getByLabel("Username").fill(chosen);
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByRole("button", { name: "Next step" }).click();

  await expect(page.getByRole("heading", { name: "Connect your calendar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect Google Calendar" })).toHaveAttribute(
    "href",
    /returnTo=\/getting-started\/connected-calendar/
  );
  await page.getByRole("button", { name: "Set up later" }).click();

  await expect(page.getByRole("heading", { name: "Set your availability" })).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();

  await expect(page.getByRole("heading", { name: "Nearly there!" })).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "Profile picture" })).toHaveAttribute("src", /^data:image\/png/);
  await page.getByLabel("About").fill("Mathematician and first programmer.");
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page).toHaveURL(/\/event-types$/);

  // Finished accounts aren't sent back, and the profile shows what was entered.
  await page.goto("/bookings/upcoming");
  await expect(page).toHaveURL(/\/bookings\/upcoming$/);
  await page.goto(`/${chosen}`);
  await expect(page.getByText("Ada Lovelace").first()).toBeVisible();
  await expect(page.getByText("Mathematician and first programmer.")).toBeVisible();
  const avatar = await page.request.get(
    (await page.locator("img[src^='/api/avatar/']").first().getAttribute("src")) ?? ""
  );
  expect(avatar.headers()["content-type"]).toBe("image/png");
});

test("a taken username keeps the user on the first step", async ({ page, browser }) => {
  const taken = uniqueName("taken");
  const other = await (await browser.newContext()).newPage();
  for (const [target, name] of [
    [other, taken],
    [page, uniqueName("second")],
  ] as const) {
    await target.goto("/auth/signup");
    await target.getByLabel("Username").fill(name);
    await target.getByLabel("Email address").fill(`${name}@example.com`);
    await target.getByLabel("Password").fill(PASSWORD);
    await target.getByRole("button", { name: "Create account" }).click();
    await expect(target).toHaveURL(/\/getting-started\/user-settings$/);
  }
  await page.getByLabel("Username").fill(taken);
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("alert")).toHaveText("Username is already taken");
  await expect(page).toHaveURL(/\/getting-started\/user-settings$/);
});

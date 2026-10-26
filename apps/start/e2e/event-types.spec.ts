import { signUp } from "./support/helpers";
import { expect, test } from "./support/test";

test("default event types, create, edit with locations and limits, unique URLs, hide and delete", async ({
  page,
  context,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  const { username } = await signUp(page);
  await expect(page.locator("ul > li")).toHaveCount(2);
  await expect(page.locator("ul > li").first()).toContainText("30 min meeting");

  await page.getByRole("button", { name: "New event type" }).click();
  await page.getByLabel("Title").fill("Intro Call");
  await expect(page.getByLabel("URL")).toHaveValue("intro-call");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Intro Call" })).toBeVisible();

  await page.getByLabel("Duration (Minutes)").fill("45");
  await page.getByLabel("Add a location").selectOption("inPerson");
  await page.getByLabel("Address").fill("1 Main Street");
  await page.getByLabel("Before event").selectOption("10");
  await page.locator("label").filter({ hasText: "Limit future bookings" }).getByRole("switch").click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByLabel("Duration (Minutes)")).toHaveValue("45");
  await expect(page.getByLabel("Address")).toHaveValue("1 Main Street");
  await expect(page.getByLabel("Before event")).toHaveValue("10");

  await page.getByRole("textbox", { name: /^URL/ }).fill("30min");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert")).toHaveText("This URL is already taken");

  await page.goto("/event-types");
  const row = page.locator("ul > li").filter({ hasText: "Intro Call" });
  await row.getByRole("switch").click();
  await expect(row).toContainText("Hidden");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await row.getByRole("button", { name: "Copy link to event" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    new RegExp(`/${username}/intro-call$`)
  );
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.locator("ul > li").filter({ hasText: "Intro Call" })).toHaveCount(0);
});

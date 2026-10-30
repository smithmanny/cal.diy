import { signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test("hosts add their own questions, which bookers must answer and see on the confirmation", async ({
  page,
  browser,
}) => {
  const { username } = await signUp(page);
  await page.goto("/event-types");
  await page.getByRole("link", { name: "30 min meeting" }).first().click();

  const question = page.getByRole("group", { name: "Add a question" });
  await page.getByRole("button", { name: "Add a question" }).click();
  await question.getByLabel("Label").fill("Company name");
  await expect(question.getByLabel("Identifier")).toHaveValue("company-name");
  await question.getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "Add a question" }).click();
  await question.getByLabel("Input type").selectOption("radio");
  await question.getByLabel("Label").fill("Team size");
  await question.getByRole("button", { name: "Save" }).click();
  await expect(question.getByRole("alert")).toHaveText("Add at least one option");
  await question.getByRole("button", { name: "Add an option" }).click();
  await question.getByLabel("Option 1").fill("Small");
  await question.getByRole("button", { name: "Add an option" }).click();
  await question.getByLabel("Option 2").fill("Large");
  await question.getByRole("button", { name: "Save" }).click();

  await page.getByRole("switch", { name: "Show on booking page: Additional notes" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByText("Company name")).toBeVisible();

  const guest = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  await guest.goto(`/${username}/30min`);
  await guest.getByRole("button", { name: "View next month" }).click();
  await guest.locator("td button:not([disabled])").first().click();
  await guest.locator("ul li button").first().click();
  await expect(guest.getByLabel("Additional notes")).toHaveCount(0);
  await guest.getByLabel("Your name").fill("Greta Guest");
  await guest.getByLabel("Email address").fill("greta@example.com");
  await guest.getByRole("button", { name: "Confirm" }).click();
  await expect(guest.getByText("This field is required.")).toHaveCount(2);
  await expect(guest.getByLabel("Company name")).toHaveAttribute("aria-invalid", "true");

  await guest.getByLabel("Company name").fill("Acme");
  await guest.getByRole("radio", { name: "Large" }).check();
  await guest.getByRole("button", { name: "Add guests" }).click();
  await guest.getByLabel("Add guests 1").fill("not-an-email");
  await guest.getByRole("button", { name: "Confirm" }).click();
  await expect(guest.getByText("That doesn't look like an email address")).toBeVisible();
  await guest.getByLabel("Add guests 1").fill("gus@example.com");
  await guest.getByRole("button", { name: "Confirm" }).click();

  await expect(guest).toHaveURL(/\/booking\//);
  await expect(guest.getByText("Acme")).toBeVisible();
  await expect(guest.getByText("Team size")).toBeVisible();
  await expect(guest.getByText("Large")).toBeVisible();
  await expect(guest.getByText("gus@example.com")).toBeVisible();
});

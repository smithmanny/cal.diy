import process from "node:process";
import { PASSWORD, signUp, uniqueName } from "./support/helpers";
import { expect, test } from "./support/test";

test("protected pages redirect to login and keep the destination", async ({ page }) => {
  await page.goto("/event-types");
  await expect(page).toHaveURL(/\/auth\/login\?callbackUrl=%2Fevent-types$/);
});

test("signup enforces Cal's password rule, then signs in, survives reload, signs out and back in", async ({
  page,
  context,
}) => {
  const navigated: string[] = [];
  page.on("framenavigated", (frame) => frame === page.mainFrame() && navigated.push(frame.url()));
  const username = uniqueName("auth");

  await page.goto("/auth/signup");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email address").fill(`${username}@example.com`);
  await page.getByLabel("Password").fill("alllowercase");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("mixture of uppercase and lowercase");

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/event-types$/);
  await page.reload();
  await expect(page.getByText(`${username}@example.com`)).toBeVisible();

  const [cookie] = (await context.cookies()).filter((c) => c.name.endsWith("session_token"));
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });

  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.getByLabel("Email address").fill(`${username}@example.com`);
  await page.getByLabel("Password").fill("Wrong1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Email or password is incorrect.");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/event-types$/);

  expect(navigated.filter((url) => /password=/i.test(url))).toEqual([]);
});

test("signed-in users aren't bounced to external callback URLs", async ({ page }) => {
  await signUp(page);
  await page.goto("/auth/login?callbackUrl=https://evil.example");
  await expect(page).toHaveURL(/\/event-types$/);
});

test("route names can't be taken as usernames", async ({ page }) => {
  await page.goto("/auth/signup");
  await page.getByLabel("Username").fill("availability");
  await page.getByLabel("Email address").fill(`${uniqueName("route")}@example.com`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toHaveText("Username is already taken");
});

test("server functions reject cross-site requests", async ({ page, request }) => {
  const serverFnUrls: string[] = [];
  page.on("request", (req) => req.url().includes("/_serverFn/") && serverFnUrls.push(req.url()));
  await signUp(page);
  await page.goto("/availability");
  await expect.poll(() => serverFnUrls.length).toBeGreaterThan(0);

  const response = await request.post(serverFnUrls[0], {
    headers: { "Sec-Fetch-Site": "cross-site", Origin: "https://evil.example" },
    data: {},
  });
  expect(response.status()).toBe(403);
  const sameOrigin = await request.post(serverFnUrls[0], {
    headers: { "Sec-Fetch-Site": "same-origin" },
    data: {},
  });
  expect(sameOrigin.status()).not.toBe(403);
});

test("repeated failed sign-ins are rate limited per client with a clear message", async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL, "rate limiting is only on in production builds");
  await page.goto("/auth/login");
  await page.getByLabel("Email address").fill(`${uniqueName("limited")}@example.com`);
  await page.getByLabel("Password").fill("Wrong1234");
  const signIn = page.getByRole("button", { name: "Sign in" });
  for (let attempt = 0; attempt < 3; attempt++) {
    await signIn.click();
    await expect(page.getByRole("alert")).toHaveText("Email or password is incorrect.");
  }
  await signIn.click();
  await expect(page.getByRole("alert")).toHaveText("Too many attempts. Please wait a moment and try again.");
});

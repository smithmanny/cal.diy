import { expect, test } from "@playwright/test";

test("renders in the browser's language, including right-to-left", async ({ browser }) => {
  for (const [locale, heading, dir] of [
    ["de-DE", "Willkommen zurück", "ltr"],
    ["ar", "أهلاً بك من جديد", "rtl"],
  ] as const) {
    const context = await browser.newContext({ locale, extraHTTPHeaders: { "Accept-Language": locale } });
    const page = await context.newPage();
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await context.close();
  }
});

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Page } from "@playwright/test";
import { signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

/**
 * Serves the embedding site from another origin, so the embed runs cross-origin as on a real site.
 * A real loopback server, since Chrome blocks pages without one from loading the app (Private
 * Network Access).
 */
async function serveEmbeddingSite(html: string) {
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

/** Cal's published inline snippet, unchanged except for the origin it loads from. */
function embeddingPage(origin: string, calLink: string): string {
  return `<!doctype html>
<html><body style="background:#fafafa">
<h1>Book with us</h1>
<div id="cal" style="width:100%"></div>
<script>
(function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "${origin}/embed/embed.js", "init");
window.calEvents = [];
Cal("init", "sales", { origin: "${origin}" });
Cal.ns.sales("on", { action: "*", callback: (e) => window.calEvents.push(e.detail) });
Cal.ns.sales("inline", { elementOrSelector: "#cal", calLink: "${calLink}", config: { theme: "dark" } });
</script>
</body></html>`;
}

type CalEvent = { type: string; data: Record<string, unknown> };

function calEvents(page: Page): Promise<CalEvent[]> {
  return page.evaluate(() => (window as unknown as { calEvents: CalEvent[] }).calEvents);
}

test("Cal's inline snippet embeds the booker, prefills it and reports the booking", async ({
  browser,
  page,
  baseURL,
}) => {
  const { username } = await signUp(page);
  const site = await (await newClientContext(browser, { timezoneId: "UTC" })).newPage();
  const embeddingSite = await serveEmbeddingSite(
    embeddingPage(baseURL ?? "", `${username}/30min?name=Ada%20Embed&email=ada@example.com`)
  );
  try {
    await bookThroughEmbed(site, embeddingSite.url);
  } finally {
    embeddingSite.close();
  }
});

async function bookThroughEmbed(site: Page, url: string) {
  await site.goto(url);

  const frame = site.frameLocator("#cal iframe");
  await expect(frame.getByRole("button", { name: "View next month" })).toBeVisible();
  await expect.poll(async () => (await calEvents(site)).map((event) => event.type)).toContain("linkReady");
  // The iframe grows to the booker instead of scrolling inside it, in the site's chosen theme.
  await expect
    .poll(() => site.locator("#cal iframe").evaluate((iframe) => iframe.clientHeight))
    .toBeGreaterThan(300);
  await expect(frame.locator("[data-theme-scope]")).toHaveClass(/\bdark\b/);

  await frame.getByRole("button", { name: "View next month" }).click();
  await frame.locator("td button:not([disabled])").first().click();
  await frame.locator("ul li button").first().click();
  await expect(frame.getByLabel("Your name")).toHaveValue("Ada Embed");
  await expect(frame.getByLabel("Email address")).toHaveValue("ada@example.com");
  await frame.getByRole("button", { name: "Confirm" }).click();
  await expect(frame.getByRole("heading", { level: 1 })).toHaveText("This meeting is scheduled");

  const success = (await calEvents(site)).find((event) => event.type === "bookingSuccessfulV2");
  expect(success?.data).toMatchObject({ title: expect.stringContaining("Ada Embed"), status: "ACCEPTED" });
  expect(success?.data.uid).toEqual(expect.any(String));
}

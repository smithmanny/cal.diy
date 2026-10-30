import { type Browser, type BrowserContextOptions, test as base } from "@playwright/test";

function clientIpHeaders(): Record<string, string> {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  const ip = `10.${octet()}.${octet()}.${octet()}`;
  // Local Workers previews accept cf-connecting-ip from the client; Cloudflare itself overwrites it.
  return { "x-forwarded-for": ip, "cf-connecting-ip": ip };
}

/**
 * Production builds rate-limit sign-in and sign-up per client IP, and every test comes from
 * localhost. Each context gets its own address, which a Node server started with
 * TRUST_PROXY=loopback and a local Workers preview believe; the dev server ignores it.
 */
export function newClientContext(browser: Browser, options: BrowserContextOptions = {}) {
  return browser.newContext({
    ...options,
    extraHTTPHeaders: { ...options.extraHTTPHeaders, ...clientIpHeaders() },
  });
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.setExtraHTTPHeaders(clientIpHeaders());
    await use(context);
  },
});

export { expect } from "@playwright/test";

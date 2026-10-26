import { type Browser, type BrowserContextOptions, test as base } from "@playwright/test";

function randomClientIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

/**
 * Production builds rate-limit sign-in and sign-up per client IP, and every test comes from
 * localhost. Each context gets its own forwarded address, which a server started with
 * TRUST_PROXY=loopback believes; the dev server ignores it.
 */
export function newClientContext(browser: Browser, options: BrowserContextOptions = {}) {
  return browser.newContext({
    ...options,
    extraHTTPHeaders: { ...options.extraHTTPHeaders, "x-forwarded-for": randomClientIp() },
  });
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
    await use(context);
  },
});

export { expect } from "@playwright/test";

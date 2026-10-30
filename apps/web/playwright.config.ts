import process from "node:process";
import { defineConfig, devices } from "@playwright/test";
import {
  APP_PORT,
  E2E_VAPID_PUBLIC_KEY,
  FAKE_APPS_PORT,
  FAKE_GOOGLE_PORT,
  FAKE_RESEND_PORT,
  FAKE_STRIPE_PORT,
  STRIPE_WEBHOOK_SECRET,
} from "./e2e/support/ports";

const PORT = APP_PORT;
const FAKE_APPS = `http://localhost:${FAKE_APPS_PORT}`;

// Points Microsoft, Zoom, Daily and iCloud at the fake apps server (e2e/support/fake-apps-server.ts).
const fakeAppsEnv = {
  MS_GRAPH_CLIENT_ID: "fake-ms-client",
  MS_GRAPH_CLIENT_SECRET: "fake-ms-secret",
  MS_OAUTH_URL: `${FAKE_APPS}/ms/oauth`,
  MS_GRAPH_API_URL: `${FAKE_APPS}/ms/graph`,
  ZOOM_CLIENT_ID: "fake-zoom-client",
  ZOOM_CLIENT_SECRET: "fake-zoom-secret",
  ZOOM_OAUTH_URL: `${FAKE_APPS}/zoom/oauth`,
  ZOOM_API_URL: `${FAKE_APPS}/zoom/api`,
  DAILY_API_KEY: "fake-daily-key",
  DAILY_API_URL: `${FAKE_APPS}/daily`,
  APPLE_CALDAV_URL: `${FAKE_APPS}/dav/`,
  // Stripe goes to e2e/support/fake-stripe-server.ts.
  STRIPE_PRIVATE_KEY: "sk_test_e2e",
  STRIPE_CLIENT_ID: "ca_e2e",
  STRIPE_WEBHOOK_SECRET,
  STRIPE_API_URL: `http://localhost:${FAKE_STRIPE_PORT}/v1`,
  STRIPE_CONNECT_URL: `http://localhost:${FAKE_STRIPE_PORT}/connect`,
};
// Set once in the runner so workers, which re-read this file, reach the same database (see e2e/support/db.ts).
process.env.E2E_DATABASE_URL ??= `file:./data/e2e-${Date.now()}.db`;
const externalBaseUrl = process.env.E2E_BASE_URL;

/**
 * Browser tests for the whole app. By default they start the dev server on a throwaway SQLite
 * file, with fake Google and webhook endpoints (see e2e/support/global-setup.ts). Set
 * E2E_BASE_URL to run them against an already running server instead (a Workers preview or the
 * Docker image); specs that need the fakes skip themselves there.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // One SQLite writer; parallel workers would just queue on the database lock.
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./e2e/support/global-setup.ts",
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `vite dev --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/api/health`,
        timeout: 120_000,
        reuseExistingServer: false,
        env: {
          DATABASE_URL: process.env.E2E_DATABASE_URL,
          BETTER_AUTH_URL: `http://localhost:${PORT}`,
          BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-00",
          GOOGLE_CLIENT_ID: "fake-client",
          GOOGLE_CLIENT_SECRET: "fake-secret",
          GOOGLE_OAUTH_AUTHORIZE_URL: `http://localhost:${FAKE_GOOGLE_PORT}/auth`,
          GOOGLE_OAUTH_TOKEN_URL: `http://localhost:${FAKE_GOOGLE_PORT}/token`,
          GOOGLE_OAUTH_REVOKE_URL: `http://localhost:${FAKE_GOOGLE_PORT}/revoke`,
          GOOGLE_CALENDAR_API_URL: `http://localhost:${FAKE_GOOGLE_PORT}/calendar/v3`,
          GOOGLE_CALENDAR_API_KEY: "fake-holiday-key",
          EMAIL_FROM: "cal@example.com",
          RESEND_API_KEY: "fake-resend-key",
          RESEND_API_URL: `http://localhost:${FAKE_RESEND_PORT}/emails`,
          // Throwaway keys for the fake push service; never use these anywhere real.
          VAPID_PUBLIC_KEY: E2E_VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY: "9Hybx7hZVQFwH-K7WA42hS3hLk2YK6Hr7X0_uF7bkLI",
          ...fakeAppsEnv,
        },
      },
});

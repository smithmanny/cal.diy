import process from "node:process";
import { defineConfig, devices } from "@playwright/test";
import { APP_PORT, FAKE_GOOGLE_PORT, FAKE_RESEND_PORT } from "./e2e/support/ports";

const PORT = APP_PORT;
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
        },
      },
});

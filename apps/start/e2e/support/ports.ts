import process from "node:process";

// E2E_PORT moves the app and its fakes together, so several checkouts can run the suite at once.
export const APP_PORT = Number(process.env.E2E_PORT ?? 3300);
export const WEBHOOK_RECEIVER_PORT = APP_PORT - 1;
export const FAKE_GOOGLE_PORT = APP_PORT - 2;
export const FAKE_RESEND_PORT = APP_PORT - 3;
export const FAKE_APPS_PORT = APP_PORT - 4;
export const FAKE_STRIPE_PORT = APP_PORT - 5;
export const STRIPE_WEBHOOK_SECRET = "whsec_e2e";

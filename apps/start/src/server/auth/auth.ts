import "@tanstack/react-start/server-only";

import process from "node:process";
import { IS_PRODUCTION_BUILD } from "../build";
import { getDb } from "../db";
import { createEmailService } from "../emails/container";
import { type Auth, type AuthEmailSender, createAuth } from "./createAuth";
import { CLIENT_IP_HEADERS } from "#runtime";

let authPromise: Promise<Auth> | undefined;

// With nodejs_compat, Workers expose vars and secrets on process.env too, so one reader serves both runtimes.
function readSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (IS_PRODUCTION_BUILD) {
    throw new Error("BETTER_AUTH_SECRET is not set. Generate one with `openssl rand -base64 32`.");
  }
  return "cal-diy-development-secret-do-not-use-in-production";
}

function authEmailSender(): AuthEmailSender | null {
  const emails = createEmailService();
  return emails ? (kind, recipient, url) => emails.sendAuthEmail(kind, recipient, url) : null;
}

async function init(): Promise<Auth> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  return createAuth({
    db: await getDb(),
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    secret: readSecret(),
    clientIpHeaders: CLIENT_IP_HEADERS,
    rateLimit: IS_PRODUCTION_BUILD,
    sendAuthEmail: authEmailSender(),
    google:
      GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
        ? { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }
        : undefined,
  });
}

export function getAuth(): Promise<Auth> {
  authPromise ??= init().catch((error) => {
    authPromise = undefined;
    throw error;
  });
  return authPromise;
}

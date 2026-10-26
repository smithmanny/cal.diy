import process from "node:process";
import { getDb } from "../db";
import { type Auth, createAuth } from "./createAuth";

let authPromise: Promise<Auth> | undefined;

// With nodejs_compat, Workers expose vars and secrets on process.env too, so one reader serves both runtimes.
function readSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is not set. Generate one with `openssl rand -base64 32`.");
  }
  return "cal-diy-development-secret-do-not-use-in-production";
}

async function init(): Promise<Auth> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  return createAuth({
    db: await getDb(),
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    secret: readSecret(),
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

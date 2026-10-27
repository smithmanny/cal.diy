import "@tanstack/react-start/server-only";

import process from "node:process";
import { IS_PRODUCTION_BUILD } from "../build";

/**
 * BETTER_AUTH_SECRET, which also signs other short-lived secrets (booker codes). With
 * nodejs_compat, Workers expose vars and secrets on process.env too, so one reader serves both runtimes.
 */
export function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (IS_PRODUCTION_BUILD) {
    throw new Error("BETTER_AUTH_SECRET is not set. Generate one with `openssl rand -base64 32`.");
  }
  return "cal-diy-development-secret-do-not-use-in-production";
}

import "@tanstack/react-start/server-only";
import process from "node:process";
import { IS_PRODUCTION_BUILD } from "../build";

export const DEV_ENCRYPTION_KEY = "cal-diy-dev-only-encryption-key!";

/**
 * Cal's CALENDSO_ENCRYPTION_KEY, which encrypts credentials and signs OAuth tokens, so what an
 * existing Cal install wrote stays readable. Development falls back to a fixed key; production
 * gets null, and the features that need it stay off.
 */
export function encryptionKey(): string | null {
  const key = process.env.CALENDSO_ENCRYPTION_KEY;
  if (key) return key;
  return IS_PRODUCTION_BUILD ? null : DEV_ENCRYPTION_KEY;
}

import "@tanstack/react-start/server-only";
import { createOTP } from "@better-auth/utils/otp";
import { AppError } from "../errors";
import type { VerificationRepository } from "./VerificationRepository";

type Deps = {
  repo: Pick<VerificationRepository, "findLive" | "replace">;
  /** Signs codes; the auth secret, so codes can't be computed without it. */
  secret: string;
  sendCode: ((email: string, code: string, locale: string) => Promise<void>) | null;
  now?: () => Date;
};

// Cal's booker codes: 6-digit TOTPs valid for 15 minutes, derived from the email address.
const PERIOD_SECONDS = 15 * 60;
const WINDOW_MS = PERIOD_SECONDS * 1000;
const MAX_SENDS = 3;
const MAX_FAILURES = 5;

type Attempts = { sent: number; failed: number };

function parseAttempts(value: string | undefined): Attempts {
  try {
    const parsed = JSON.parse(value ?? "{}") as Partial<Attempts>;
    return { sent: Number(parsed.sent) || 0, failed: Number(parsed.failed) || 0 };
  } catch {
    return { sent: 0, failed: 0 };
  }
}

async function hmacHex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Proves a booker owns the email they book with, for event types that require it. Codes are
 * stateless like Cal's; only the send and failure counts are stored, so limits hold across
 * Workers isolates.
 */
export class BookerVerificationService {
  constructor(private readonly deps: Deps) {}

  async send(email: string, locale: string): Promise<void> {
    if (!this.deps.sendCode) throw new AppError("something_went_wrong");
    const key = this.key(email);
    const now = this.now();
    const stored = await this.deps.repo.findLive(key, now);
    const attempts = parseAttempts(stored?.value);
    if (attempts.sent >= MAX_SENDS) throw new AppError("too_many_attempts", 429);
    const code = await (await this.otp(email)).totp();
    await this.deps.repo.replace(
      key,
      JSON.stringify({ ...attempts, sent: attempts.sent + 1 }),
      stored?.expiresAt ?? new Date(now.getTime() + WINDOW_MS)
    );
    await this.deps.sendCode(email, code, locale);
  }

  async verify(email: string, code: string): Promise<void> {
    const key = this.key(email);
    const now = this.now();
    const stored = await this.deps.repo.findLive(key, now);
    const attempts = parseAttempts(stored?.value);
    if (attempts.failed >= MAX_FAILURES) throw new AppError("too_many_attempts", 429);
    // The previous period too, so a code sent just before a boundary still works.
    if (await (await this.otp(email)).verify(code, { window: 1 })) return;
    await this.deps.repo.replace(
      key,
      JSON.stringify({ ...attempts, failed: attempts.failed + 1 }),
      stored?.expiresAt ?? new Date(now.getTime() + WINDOW_MS)
    );
    throw new AppError("invalid_verification_code", 400, { field: "verificationCode" });
  }

  private key(email: string): string {
    return `booker-verification:${email.trim().toLowerCase()}`;
  }

  private async otp(email: string) {
    const secret = await hmacHex(this.deps.secret, this.key(email));
    return createOTP(secret, { digits: 6, period: PERIOD_SECONDS });
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }
}

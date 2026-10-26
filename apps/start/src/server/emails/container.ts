import "@tanstack/react-start/server-only";

import process from "node:process";
import { pickMessages } from "../catalog";
import { EmailService } from "./EmailService";
import { createResendSender, type EmailSender } from "./sender";
import { createSmtpSender } from "#runtime";

/** Resend (HTTP, any runtime) if RESEND_API_KEY is set, otherwise SMTP via Cal's EMAIL_SERVER_* on Node. */
function createSender(): EmailSender | null {
  if (process.env.RESEND_API_KEY) return createResendSender(process.env.RESEND_API_KEY);
  return createSmtpSender();
}

export function isEmailEnabled(): boolean {
  return Boolean(process.env.EMAIL_FROM && (process.env.RESEND_API_KEY || process.env.EMAIL_SERVER_HOST));
}

export function createEmailService(): EmailService | null {
  const from = process.env.EMAIL_FROM;
  const send = from ? createSender() : null;
  if (!from || !send) return null;
  return new EmailService({
    send,
    from: `${process.env.EMAIL_FROM_NAME ?? "Cal.diy"} <${from}>`,
    publicUrl: (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
    loadMessages: pickMessages,
  });
}

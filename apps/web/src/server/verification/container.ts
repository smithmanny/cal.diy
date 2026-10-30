import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { authSecret } from "../auth/secret";
import { createEmailService } from "../emails/container";
import { BookerVerificationService } from "./BookerVerificationService";
import { VerificationRepository } from "./VerificationRepository";

export function createBookerVerification(db: Database): BookerVerificationService {
  const emails = createEmailService();
  return new BookerVerificationService({
    repo: new VerificationRepository(db),
    secret: authSecret(),
    sendCode: emails ? (email, code, locale) => emails.sendBookerCode(email, code, locale) : null,
  });
}

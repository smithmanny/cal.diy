import "@tanstack/react-start/server-only";
import type { Database } from "@calcom/db/database";
import { verification } from "@calcom/db/schema";
import { and, desc, eq, gt } from "drizzle-orm";

/** Better Auth's Verification table, used here for short-lived counters keyed by identifier. */
export class VerificationRepository {
  constructor(private readonly db: Database) {}

  async findLive(identifier: string, now: Date): Promise<{ value: string; expiresAt: Date } | null> {
    const [found] = await this.db
      .select({ value: verification.value, expiresAt: verification.expiresAt })
      .from(verification)
      .where(and(eq(verification.identifier, identifier), gt(verification.expiresAt, now)))
      .orderBy(desc(verification.id))
      .limit(1);
    return found ?? null;
  }

  /** Replaces whatever is stored under `identifier`, in one batch. */
  async replace(identifier: string, value: string, expiresAt: Date): Promise<void> {
    await this.db.batch([
      this.db.delete(verification).where(eq(verification.identifier, identifier)),
      this.db.insert(verification).values({ identifier, value, expiresAt }),
    ]);
  }
}

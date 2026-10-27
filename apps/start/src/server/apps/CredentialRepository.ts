import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { credential } from "@calcom/db/schema";
import { and, eq, inArray } from "drizzle-orm";

type CredentialRow = {
  id: number;
  type: string;
  userId: number | null;
  key: unknown;
  encryptedKey: string | null;
  invalid: boolean | null;
};

const columns = {
  id: credential.id,
  type: credential.type,
  userId: credential.userId,
  key: credential.key,
  encryptedKey: credential.encryptedKey,
  invalid: credential.invalid,
};

export type { CredentialRow };

export class CredentialRepository {
  constructor(private readonly db: Database) {}

  findByUserId(userId: number, types?: string[]): Promise<CredentialRow[]> {
    return this.db
      .select(columns)
      .from(credential)
      .where(
        types
          ? and(eq(credential.userId, userId), inArray(credential.type, types))
          : eq(credential.userId, userId)
      )
      .orderBy(credential.id);
  }

  async findById(id: number): Promise<CredentialRow | null> {
    const [found] = await this.db.select(columns).from(credential).where(eq(credential.id, id)).limit(1);
    return found ?? null;
  }

  async create(userId: number, type: string, encryptedKey: string | null): Promise<number> {
    const [created] = await this.db
      .insert(credential)
      // The real key lives in encryptedKey; `key` is NOT NULL in Cal's schema.
      .values({ userId, type, key: {}, encryptedKey })
      .returning({ id: credential.id });
    return created.id;
  }

  async updateKey(id: number, encryptedKey: string): Promise<void> {
    await this.db
      .update(credential)
      .set({ key: {}, encryptedKey, invalid: false })
      .where(eq(credential.id, id));
  }

  async markInvalid(id: number): Promise<void> {
    await this.db.update(credential).set({ invalid: true }).where(eq(credential.id, id));
  }

  async delete(id: number): Promise<void> {
    // SelectedCalendar/DestinationCalendar cascade; booking references keep their history (SET NULL).
    await this.db.delete(credential).where(eq(credential.id, id));
  }
}

import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { credential } from "@calcom/db/schema";
import { and, eq, inArray } from "drizzle-orm";

type CredentialRow = {
  id: number;
  type: string;
  userId: number | null;
  teamId: number | null;
  key: unknown;
  encryptedKey: string | null;
  invalid: boolean | null;
};

const columns = {
  id: credential.id,
  type: credential.type,
  userId: credential.userId,
  teamId: credential.teamId,
  key: credential.key,
  encryptedKey: credential.encryptedKey,
  invalid: credential.invalid,
};

/** Apps are installed for a person, or for a team so its event types can use them. */
type CredentialOwner = { userId: number } | { teamId: number };

export type { CredentialOwner, CredentialRow };

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

  findByTeamId(teamId: number, types?: string[]): Promise<CredentialRow[]> {
    return this.db
      .select(columns)
      .from(credential)
      .where(
        types
          ? and(eq(credential.teamId, teamId), inArray(credential.type, types))
          : eq(credential.teamId, teamId)
      )
      .orderBy(credential.id);
  }

  findByTeamIds(teamIds: number[]): Promise<CredentialRow[]> {
    if (!teamIds.length) return Promise.resolve([]);
    return this.db
      .select(columns)
      .from(credential)
      .where(inArray(credential.teamId, teamIds))
      .orderBy(credential.id);
  }

  async findById(id: number): Promise<CredentialRow | null> {
    const [found] = await this.db.select(columns).from(credential).where(eq(credential.id, id)).limit(1);
    return found ?? null;
  }

  async create(owner: CredentialOwner, type: string, encryptedKey: string | null): Promise<number> {
    const ownerColumns = "teamId" in owner ? { teamId: owner.teamId } : { userId: owner.userId };
    const [created] = await this.db
      .insert(credential)
      // The real key lives in encryptedKey; `key` is NOT NULL in Cal's schema.
      .values({ ...ownerColumns, type, key: {}, encryptedKey })
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

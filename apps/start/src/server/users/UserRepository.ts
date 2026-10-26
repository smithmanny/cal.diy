import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { account, user } from "@calcom/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";

export class UserRepository {
  constructor(private readonly db: Database) {}

  /** Usernames are unique per organization; users outside an organization share one namespace. */
  async findTakenUsernamesWithoutOrganization(usernames: string[]): Promise<Set<string>> {
    if (!usernames.length) return new Set();
    const rows = await this.db
      .select({ username: user.username })
      .from(user)
      .where(and(inArray(user.username, usernames), isNull(user.organizationId)));
    return new Set(rows.flatMap((row) => (row.username ? [row.username] : [])));
  }

  async findDefaultScheduleId(userId: number): Promise<number | null> {
    const [found] = await this.db
      .select({ defaultScheduleId: user.defaultScheduleId })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return found?.defaultScheduleId ?? null;
  }

  async updateDefaultScheduleId(userId: number, scheduleId: number | null): Promise<void> {
    await this.db.update(user).set({ defaultScheduleId: scheduleId }).where(eq(user.id, userId));
  }

  /** Users outside an organization, which is every user until organizations are ported. */
  async findByUsername(username: string) {
    const [found] = await this.db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        timeZone: user.timeZone,
        locale: user.locale,
        defaultScheduleId: user.defaultScheduleId,
        avatarUrl: user.avatarUrl,
        weekStart: user.weekStart,
        allowSEOIndexing: user.allowSEOIndexing,
        allowDynamicBooking: user.allowDynamicBooking,
        requiresBookerEmailVerification: user.requiresBookerEmailVerification,
      })
      .from(user)
      .where(and(eq(user.username, username.toLowerCase()), isNull(user.organizationId)))
      .limit(1);
    return found ?? null;
  }

  async findProfile(userId: number) {
    const [found] = await this.db
      .select({
        name: user.name,
        email: user.email,
        username: user.username,
        timeZone: user.timeZone,
        locale: user.locale,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return found ?? null;
  }

  async findGeneralSettings(userId: number) {
    const [found] = await this.db
      .select({
        timeFormat: user.timeFormat,
        weekStart: user.weekStart,
        allowDynamicBooking: user.allowDynamicBooking,
        allowSEOIndexing: user.allowSEOIndexing,
        requiresBookerEmailVerification: user.requiresBookerEmailVerification,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return found ?? null;
  }

  async updateGeneralSettings(
    userId: number,
    data: {
      timeFormat: number;
      weekStart: string;
      allowDynamicBooking: boolean;
      allowSEOIndexing: boolean;
      requiresBookerEmailVerification: boolean;
    }
  ): Promise<void> {
    await this.db.update(user).set(data).where(eq(user.id, userId));
  }

  /** What the security settings need: whether a password exists, and the 2FA and verification state. */
  async findSecurity(userId: number) {
    const [found] = await this.db
      .select({
        email: user.email,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        passwordAccountId: account.id,
      })
      .from(user)
      .leftJoin(account, and(eq(account.userId, user.id), eq(account.providerId, "credential")))
      .where(eq(user.id, userId))
      .limit(1);
    if (!found) return null;
    const { passwordAccountId, ...rest } = found;
    return { ...rest, hasPassword: passwordAccountId !== null };
  }

  async updateProfile(
    userId: number,
    data: { name: string; timeZone: string; locale: string }
  ): Promise<void> {
    await this.db.update(user).set(data).where(eq(user.id, userId));
  }

  async findByEmail(email: string) {
    const [found] = await this.db
      .select({ id: user.id, email: user.email, username: user.username })
      .from(user)
      .where(eq(user.email, email.toLowerCase()))
      .limit(1);
    return found ?? null;
  }
}

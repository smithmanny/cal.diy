import "@tanstack/react-start/server-only";
import type { Database } from "@calcom/db/database";
import { avatar, user } from "@calcom/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";

type OnboardingState = {
  name: string | null;
  username: string | null;
  timeZone: string;
  bio: string | null;
  avatarUrl: string | null;
  defaultScheduleId: number | null;
  completedOnboarding: boolean;
};

export class OnboardingRepository {
  constructor(private readonly db: Database) {}

  async findState(userId: number): Promise<OnboardingState | null> {
    const [found] = await this.db
      .select({
        name: user.name,
        username: user.username,
        timeZone: user.timeZone,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        defaultScheduleId: user.defaultScheduleId,
        completedOnboarding: user.completedOnboarding,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return found ?? null;
  }

  /** Whether another user outside an organization already has this username. */
  async isUsernameTaken(username: string, exceptUserId: number): Promise<boolean> {
    const [found] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.username, username), isNull(user.organizationId), ne(user.id, exceptUserId)))
      .limit(1);
    return Boolean(found);
  }

  async updateUser(
    userId: number,
    data: { name: string; username: string; timeZone: string }
  ): Promise<void> {
    await this.db.update(user).set(data).where(eq(user.id, userId));
  }

  async updateProfile(
    userId: number,
    data: { bio: string | null; avatarUrl?: string | null }
  ): Promise<void> {
    await this.db.update(user).set(data).where(eq(user.id, userId));
  }

  /** Replaces the user's avatar image (Cal's `avatars` table, one per user). */
  async saveAvatar(userId: number, data: string, objectKey: string): Promise<void> {
    await this.db
      .insert(avatar)
      .values({ userId, teamId: 0, isBanner: false, data, objectKey })
      .onConflictDoUpdate({
        target: [avatar.teamId, avatar.userId, avatar.isBanner],
        set: { data, objectKey },
      });
  }

  async findAvatar(objectKey: string): Promise<string | null> {
    const [found] = await this.db
      .select({ data: avatar.data })
      .from(avatar)
      .where(eq(avatar.objectKey, objectKey))
      .limit(1);
    return found?.data ?? null;
  }

  async complete(userId: number): Promise<void> {
    await this.db.update(user).set({ completedOnboarding: true }).where(eq(user.id, userId));
  }
}

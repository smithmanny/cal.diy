import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { user } from "@calcom/db/schema";
import { eq } from "drizzle-orm";

const meColumns = {
  id: user.id,
  username: user.username,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  bio: user.bio,
  timeFormat: user.timeFormat,
  defaultScheduleId: user.defaultScheduleId,
  weekStart: user.weekStart,
  timeZone: user.timeZone,
  locale: user.locale,
  organizationId: user.organizationId,
};

const ownerColumns = {
  id: user.id,
  name: user.name,
  username: user.username,
  avatarUrl: user.avatarUrl,
  weekStart: user.weekStart,
  brandColor: user.brandColor,
  darkBrandColor: user.darkBrandColor,
  metadata: user.metadata,
  timeZone: user.timeZone,
};

type MeRow = NonNullable<Awaited<ReturnType<ApiUserRepository["findMe"]>>>;
type OwnerRow = NonNullable<Awaited<ReturnType<ApiUserRepository["findOwner"]>>>;

type MeUpdate = Partial<{
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  timeFormat: number;
  defaultScheduleId: number;
  weekStart: string;
  timeZone: string;
  locale: string;
}>;

/** The user data the public API reads and writes, kept apart from the app's own queries. */
class ApiUserRepository {
  constructor(private readonly db: Database) {}

  async findMe(id: number) {
    const [found] = await this.db.select(meColumns).from(user).where(eq(user.id, id)).limit(1);
    return found ?? null;
  }

  /** The owner of an event type, as Cal's event type output lists them under `users`. */
  async findOwner(id: number) {
    const [found] = await this.db.select(ownerColumns).from(user).where(eq(user.id, id)).limit(1);
    return found ?? null;
  }

  async update(id: number, data: MeUpdate): Promise<void> {
    if (!Object.keys(data).length) return;
    await this.db.update(user).set(data).where(eq(user.id, id));
  }
}

export type { MeRow, OwnerRow, MeUpdate };
export { ApiUserRepository };

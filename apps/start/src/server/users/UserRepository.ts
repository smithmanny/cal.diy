import type { Database } from "@calcom/db/database";
import { user } from "@calcom/db/schema";
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

  async findByEmail(email: string) {
    const [found] = await this.db
      .select({ id: user.id, email: user.email, username: user.username })
      .from(user)
      .where(eq(user.email, email.toLowerCase()))
      .limit(1);
    return found ?? null;
  }
}

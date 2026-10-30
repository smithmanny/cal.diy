import "@tanstack/react-start/server-only";
import type { Database } from "@calcom/db/database";
import { user } from "@calcom/db/schema";
import { and, asc, count, eq, isNull, ne, or, type SQL, sql } from "drizzle-orm";

const adminUserColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  username: user.username,
  role: user.role,
  locked: user.locked,
  timeZone: user.timeZone,
  locale: user.locale,
  createdDate: user.createdDate,
};

/** The instance's users as an admin sees them. */
export class AdminUserRepository {
  constructor(private readonly db: Database) {}

  async list({ search, offset, limit }: { search?: string; offset: number; limit: number }) {
    const where = this.searchCondition(search);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(adminUserColumns)
        .from(user)
        .where(where)
        .orderBy(asc(user.id))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(user).where(where),
    ]);
    return { users: rows, total };
  }

  async findById(id: number) {
    const [row] = await this.db.select(adminUserColumns).from(user).where(eq(user.id, id)).limit(1);
    return row ?? null;
  }

  /** Usernames are shared by users outside an organization, as at sign-up. */
  async isUsernameTakenByOther(username: string, id: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.username, username), isNull(user.organizationId), ne(user.id, id)))
      .limit(1);
    return Boolean(row);
  }

  async isEmailTakenByOther(email: string, id: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, email), ne(user.id, id)))
      .limit(1);
    return Boolean(row);
  }

  private searchCondition(search: string | undefined): SQL | undefined {
    if (!search) return undefined;
    const pattern = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    // SQLite's LIKE ignores ASCII case.
    return or(
      sql`${user.name} LIKE ${pattern} ESCAPE '\\'`,
      sql`${user.email} LIKE ${pattern} ESCAPE '\\'`,
      sql`${user.username} LIKE ${pattern} ESCAPE '\\'`
    );
  }
}

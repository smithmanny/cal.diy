import "@tanstack/react-start/server-only";
import { matchLocale } from "~/lib/locales";
import { RESERVED_USERNAMES } from "~/lib/reserved-usernames";
import { normalizeUsername } from "../auth/username";
import { AppError } from "../errors";
import { isValidTimeZone } from "../schedules/scheduleMapper";
import type { AdminUserRepository } from "./AdminUserRepository";

/** The Better Auth admin endpoints this service uses, acting as the signed-in admin. */
type AdminAuthApi = {
  updateUser(userId: number, data: Record<string, string | null>): Promise<void>;
  setRole(userId: number, role: "USER" | "ADMIN"): Promise<void>;
  lock(userId: number): Promise<void>;
  unlock(userId: number): Promise<void>;
  remove(userId: number): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
};

type AdminUserInput = {
  name: string;
  email: string;
  username: string;
  role: "USER" | "ADMIN";
  timeZone: string;
  locale: string;
};

type Deps = {
  repo: Pick<AdminUserRepository, "list" | "findById" | "isUsernameTakenByOther" | "isEmailTakenByOther">;
  auth: AdminAuthApi;
};

/** Cal's admin user management, over Better Auth's admin plugin. */
class AdminService {
  constructor(private readonly deps: Deps) {}

  async list(search: string | undefined, page: number, pageSize: number) {
    const { users, total } = await this.deps.repo.list({
      search: search?.trim() || undefined,
      offset: page * pageSize,
      limit: pageSize,
    });
    return {
      users: users.map(({ createdDate, ...row }) => ({ ...row, createdDate: createdDate.toISOString() })),
      total,
    };
  }

  async get(id: number) {
    const found = await this.deps.repo.findById(id);
    if (!found) throw new AppError("user_not_found", 404);
    return { ...found, createdDate: found.createdDate.toISOString() };
  }

  async update(adminId: number, id: number, input: AdminUserInput): Promise<void> {
    const current = await this.get(id);
    const username = normalizeUsername(input.username);
    if (
      !username ||
      RESERVED_USERNAMES.has(username) ||
      (await this.deps.repo.isUsernameTakenByOther(username, id))
    )
      throw new AppError("username_already_taken", 409);
    const email = input.email.trim().toLowerCase();
    if (await this.deps.repo.isEmailTakenByOther(email, id)) throw new AppError("email_already_used", 409);
    if (!isValidTimeZone(input.timeZone)) throw new AppError("invalid_timezone", 400);
    const locale = matchLocale(input.locale);
    if (!locale) throw new AppError("something_went_wrong", 400);
    // An instance always keeps the admin doing the editing.
    if (id === adminId && input.role !== "ADMIN") throw new AppError("cannot_change_own_role", 400);
    await this.deps.auth.updateUser(id, {
      name: input.name.trim(),
      email,
      username,
      timeZone: input.timeZone,
      locale,
    });
    if (current.role !== input.role) await this.deps.auth.setRole(id, input.role);
  }

  async setLocked(adminId: number, id: number, locked: boolean): Promise<void> {
    if (id === adminId) throw new AppError("cannot_lock_yourself", 400);
    await this.get(id);
    await (locked ? this.deps.auth.lock(id) : this.deps.auth.unlock(id));
  }

  async remove(adminId: number, id: number): Promise<void> {
    if (id === adminId) throw new AppError("cannot_delete_yourself", 400);
    await this.get(id);
    await this.deps.auth.remove(id);
  }

  async sendPasswordReset(id: number): Promise<void> {
    const found = await this.get(id);
    await this.deps.auth.sendPasswordReset(found.email);
  }
}

export type { AdminAuthApi, AdminUserInput };
export { AdminService };

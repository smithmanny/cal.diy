import type { Database } from "@calcom/db/database";
import { user } from "@calcom/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../test/testDb";
import { type AdminAuthApi, AdminService } from "./AdminService";
import { AdminUserRepository } from "./AdminUserRepository";

let db: Database;
let auth: { [K in keyof AdminAuthApi]: ReturnType<typeof vi.fn> } & AdminAuthApi;
let service: AdminService;
let adminId: number;
let memberId: number;

beforeEach(async () => {
  db = await createTestDb();
  auth = {
    updateUser: vi.fn(async () => undefined),
    setRole: vi.fn(async () => undefined),
    lock: vi.fn(async () => undefined),
    unlock: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    sendPasswordReset: vi.fn(async () => undefined),
  };
  service = new AdminService({ repo: new AdminUserRepository(db), auth });
  const rows = await db
    .insert(user)
    .values([
      { email: "admin@example.com", username: "admin", name: "Ada Admin", role: "ADMIN" },
      { email: "grace@example.com", username: "grace", name: "Grace 100%" },
      { email: "linus@example.com", username: "linus", name: "Linus" },
    ])
    .returning({ id: user.id });
  [{ id: adminId }, { id: memberId }] = rows;
});

const input = {
  name: " Grace Hopper ",
  email: "Grace@Navy.mil",
  username: "Grace H",
  role: "USER" as const,
  timeZone: "America/New_York",
  locale: "de",
};

describe("AdminService", () => {
  it("lists users by name, email or username, a page at a time", async () => {
    expect((await service.list("NAVY", 0, 10)).total).toBe(0);
    expect((await service.list("grac", 0, 10)).users.map((row) => row.email)).toEqual(["grace@example.com"]);
    // `%` is matched literally.
    expect((await service.list("100%", 0, 10)).users).toHaveLength(1);
    const page = await service.list(undefined, 1, 2);
    expect(page).toMatchObject({ total: 3, users: [{ email: "linus@example.com" }] });
  });

  it("updates a user through Better Auth with a normalized username and email", async () => {
    await service.update(adminId, memberId, { ...input, role: "ADMIN" });
    expect(auth.updateUser).toHaveBeenCalledWith(memberId, {
      name: "Grace Hopper",
      email: "grace@navy.mil",
      username: "grace-h",
      timeZone: "America/New_York",
      locale: "de",
    });
    expect(auth.setRole).toHaveBeenCalledWith(memberId, "ADMIN");
  });

  it("refuses taken usernames and emails, bad time zones, and demoting yourself", async () => {
    await expect(service.update(adminId, memberId, { ...input, username: "linus" })).rejects.toMatchObject({
      code: "username_already_taken",
    });
    await expect(
      service.update(adminId, memberId, { ...input, email: "LINUS@example.com" })
    ).rejects.toMatchObject({ code: "email_already_used" });
    await expect(
      service.update(adminId, memberId, { ...input, timeZone: "Mars/Base" })
    ).rejects.toMatchObject({
      code: "invalid_timezone",
    });
    await expect(
      service.update(adminId, adminId, { ...input, username: "admin", email: "admin@example.com" })
    ).rejects.toMatchObject({ code: "cannot_change_own_role" });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("locks, unlocks, deletes and resets others, but never the admin themselves", async () => {
    await service.setLocked(adminId, memberId, true);
    await service.setLocked(adminId, memberId, false);
    await service.sendPasswordReset(memberId);
    await service.remove(adminId, memberId);
    expect(auth.lock).toHaveBeenCalledWith(memberId);
    expect(auth.unlock).toHaveBeenCalledWith(memberId);
    expect(auth.sendPasswordReset).toHaveBeenCalledWith("grace@example.com");
    expect(auth.remove).toHaveBeenCalledWith(memberId);
    await expect(service.setLocked(adminId, adminId, true)).rejects.toMatchObject({
      code: "cannot_lock_yourself",
    });
    await expect(service.remove(adminId, adminId)).rejects.toMatchObject({ code: "cannot_delete_yourself" });
    await expect(service.get(99999)).rejects.toMatchObject({ code: "user_not_found" });
  });
});

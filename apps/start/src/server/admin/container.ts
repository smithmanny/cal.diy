import "@tanstack/react-start/server-only";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "../auth/auth";
import { getDb } from "../db";
import { type AdminAuthApi, AdminService } from "./AdminService";
import { AdminUserRepository } from "./AdminUserRepository";

/** Better Auth's admin endpoints, called as the admin making this request so the plugin checks their role. */
async function adminAuthApi(): Promise<AdminAuthApi> {
  const auth = await getAuth();
  const headers = getRequestHeaders();
  return {
    updateUser: async (userId, data) => {
      await auth.api.adminUpdateUser({ body: { userId: String(userId), data }, headers });
    },
    setRole: async (userId, role) => {
      await auth.api.setRole({ body: { userId: String(userId), role }, headers });
    },
    lock: async (userId) => {
      await auth.api.banUser({ body: { userId: String(userId) }, headers });
    },
    unlock: async (userId) => {
      await auth.api.unbanUser({ body: { userId: String(userId) }, headers });
    },
    remove: async (userId) => {
      await auth.api.removeUser({ body: { userId: String(userId) }, headers });
    },
    sendPasswordReset: async (email) => {
      await auth.api.requestPasswordReset({ body: { email, redirectTo: "/auth/reset-password" } });
    },
  };
}

export async function getAdminService(): Promise<AdminService> {
  return new AdminService({ repo: new AdminUserRepository(await getDb()), auth: await adminAuthApi() });
}

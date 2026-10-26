import type { Database } from "@calcom/db/database";
import { account, session, user, verification } from "@calcom/db/schema";
import { isPasswordValid } from "@calcom/lib/auth/isPasswordValid";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { UserRepository } from "../users/UserRepository";
import { findAvailableUsername, normalizeUsername, usernameFromEmail } from "./username";

export type AuthConfig = {
  db: Database;
  baseURL: string;
  secret: string;
  google?: { clientId: string; clientSecret: string };
};

// Error codes are i18n keys from packages/i18n/locales/en/common.json; the client translates them.
export const AUTH_ERROR_CODES = {
  invalidPassword: "invalid_password_hint",
  usernameTaken: "username_already_taken",
} as const;

export function createAuth({ db, baseURL, secret, google }: AuthConfig) {
  const users = new UserRepository(db);

  return betterAuth({
    appName: "Cal.diy",
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: "sqlite", schema: { user, session, account, verification } }),
    advanced: {
      // Cal's users.id (and every foreign key to it) is an integer, so all auth ids are serial too.
      database: { generateId: "serial" },
      cookiePrefix: "cal",
    },
    user: {
      fields: { image: "avatarUrl", createdAt: "createdDate" },
      additionalFields: {
        username: { type: "string", required: false, input: true },
        timeZone: { type: "string", required: false, input: true },
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 7,
    },
    socialProviders: google ? { google: { ...google, prompt: "select_account" } } : {},
    account: {
      // Google sign-in for an existing email/password user links instead of failing.
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const password: unknown = ctx.body?.password;
        // Same rule as the old signup flow; Better Auth only checks length.
        if (typeof password !== "string" || !isPasswordValid(password)) {
          throw new APIError("BAD_REQUEST", {
            message: AUTH_ERROR_CODES.invalidPassword,
            code: AUTH_ERROR_CODES.invalidPassword,
          });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (newUser) => {
            const requested = typeof newUser.username === "string" ? normalizeUsername(newUser.username) : "";
            if (requested) {
              const username = requested;
              const taken = await users.findTakenUsernamesWithoutOrganization([username]);
              if (taken.has(username)) {
                throw new APIError("BAD_REQUEST", {
                  message: AUTH_ERROR_CODES.usernameTaken,
                  code: AUTH_ERROR_CODES.usernameTaken,
                });
              }
              return { data: { ...newUser, username } };
            }
            // OAuth sign-ups have no username field, and every user needs one for their booking links.
            return {
              data: {
                ...newUser,
                username: await findAvailableUsername(users, usernameFromEmail(newUser.email)),
              },
            };
          },
        },
      },
    },
    plugins: [tanstackStartCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

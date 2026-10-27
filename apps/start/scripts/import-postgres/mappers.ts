import { user } from "@calcom/db/schema";
import { convertRow, parsePostgresDate, type SourceRow, type TargetRow } from "./convert";

// Tables whose shape changed with Better Auth, mapped by hand. Everything else in the import plan
// goes through convertRow alone.

/** Same as createAuth's api-key plugin settings, which Better Auth copies onto each key it creates. */
const API_KEY_DEFAULTS = {
  configId: "default",
  prefix: "cal_",
  enabled: true,
  rateLimitEnabled: true,
  rateLimitTimeWindow: 60_000,
  rateLimitMax: 120,
  requestCount: 0,
};

const optionalString = (value: unknown) => (typeof value === "string" && value ? value : null);
const optionalDate = (value: unknown) => (typeof value === "string" ? parsePostgresDate(value) : null);

type TwoFactorCrypto = {
  /** Cal's symmetricDecrypt with CALENDSO_ENCRYPTION_KEY; null when that key wasn't given. */
  decryptCal: ((text: string) => Promise<string>) | null;
  /** Better Auth's symmetricEncrypt with BETTER_AUTH_SECRET. */
  encryptBetterAuth: (text: string) => Promise<string>;
  randomSecret: () => string;
};

/** Cal showed backup codes as "abcde-12345" but stored them without the dash; Better Auth keeps it. */
function backupCodeWithDash(code: string): string {
  return code.includes("-") ? code : `${code.slice(0, 5)}-${code.slice(5)}`;
}

async function remainingBackupCodes(encrypted: unknown, crypto: TwoFactorCrypto): Promise<string[]> {
  if (typeof encrypted !== "string" || !encrypted || !crypto.decryptCal) return [];
  const codes: unknown = JSON.parse(await crypto.decryptCal(encrypted));
  if (!Array.isArray(codes)) return [];
  // Cal marks a used code by setting it to null.
  return codes
    .filter((code): code is string => typeof code === "string" && code !== "")
    .map(backupCodeWithDash);
}

/** The 2FA secret and backup codes move to the TwoFactor table (see twoFactorFromUser). */
export function mapUser(row: SourceRow): TargetRow {
  return { ...convertRow(user, row), twoFactorSecret: null, backupCodes: null };
}

/** A NextAuth OAuth account (Google, SAML) in Better Auth's shape. `expires_at` is in seconds. */
export function mapNextAuthAccount(row: SourceRow): TargetRow {
  return {
    userId: row.userId,
    providerId: row.provider,
    accountId: row.providerAccountId,
    accessToken: optionalString(row.access_token),
    refreshToken: optionalString(row.refresh_token),
    idToken: optionalString(row.id_token),
    accessTokenExpiresAt: typeof row.expires_at === "number" ? new Date(row.expires_at * 1000) : null,
    scope: optionalString(row.scope),
  };
}

/**
 * A UserPassword row as Better Auth's email/password account. The bcrypt hash is kept;
 * createPasswordVerifier accepts it and swaps in an scrypt hash at the next sign-in.
 */
export function mapUserPassword(row: SourceRow): TargetRow {
  return {
    userId: row.userId,
    providerId: "credential",
    accountId: String(row.userId),
    password: row.hash,
  };
}

/** Cal stored SHA-256 as hex, Better Auth stores the same digest as unpadded base64url. */
export function apiKeyDigest(hexDigest: string): string {
  return Buffer.from(hexDigest, "hex").toString("base64url");
}

/** Personal API keys keep working; team keys have no owner yet, so they are skipped. */
export function mapApiKey(row: SourceRow): TargetRow | null {
  if (typeof row.userId !== "number" || row.teamId != null) return null;
  return {
    ...API_KEY_DEFAULTS,
    referenceId: String(row.userId),
    name: optionalString(row.note),
    key: apiKeyDigest(String(row.hashedKey)),
    expiresAt: optionalDate(row.expiresAt),
    lastRequest: optionalDate(row.lastUsedAt),
    createdAt: optionalDate(row.createdAt) ?? new Date(),
  };
}

/**
 * Better Auth's TwoFactor row for a user with 2FA on. The authenticator secret can't come along:
 * Cal keyed TOTP with the base32-decoded secret, Better Auth with the secret's text, so the codes
 * would never match. 2FA stays required; the user signs in with a remaining backup code and sets up
 * their authenticator app again. The stored secret is random and known to no one.
 */
export async function twoFactorFromUser(
  row: SourceRow,
  crypto: TwoFactorCrypto,
  warn: (message: string) => void
): Promise<TargetRow | null> {
  if (row.twoFactorEnabled !== true) return null;
  const backupCodes = await remainingBackupCodes(row.backupCodes, crypto);
  if (!backupCodes.length) {
    warn(`User ${row.id} has 2FA on and no backup codes left; they can't sign in until 2FA is reset.`);
  }
  return {
    userId: row.id,
    secret: await crypto.encryptBetterAuth(crypto.randomSecret()),
    backupCodes: await crypto.encryptBetterAuth(JSON.stringify(backupCodes)),
    verified: true,
  };
}

export type { TwoFactorCrypto };

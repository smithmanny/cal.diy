import "@tanstack/react-start/server-only";
import type { Database } from "@calcom/db/database";
import type { AccessScope, OAuthClientType } from "@calcom/db/enums";
import { accessCode, oAuthClient } from "@calcom/db/schema";
import { and, desc, eq, gt, lte, or } from "drizzle-orm";

const publicClientColumns = {
  clientId: oAuthClient.clientId,
  redirectUri: oAuthClient.redirectUri,
  name: oAuthClient.name,
  logo: oAuthClient.logo,
  clientType: oAuthClient.clientType,
  status: oAuthClient.status,
  isTrusted: oAuthClient.isTrusted,
  userId: oAuthClient.userId,
  createdAt: oAuthClient.createdAt,
};

/** Cal's OAuthClient and AccessCode tables. */
export class OAuthRepository {
  constructor(private readonly db: Database) {}

  async createClient(data: {
    clientId: string;
    hashedSecret: string | null;
    name: string;
    redirectUri: string;
    logo: string | null;
    clientType: OAuthClientType;
    userId: number;
  }): Promise<void> {
    await this.db.insert(oAuthClient).values({
      clientId: data.clientId,
      clientSecret: data.hashedSecret,
      name: data.name,
      redirectUri: data.redirectUri,
      logo: data.logo,
      clientType: data.clientType,
      userId: data.userId,
      status: "APPROVED",
    });
  }

  listClients() {
    return this.db.select(publicClientColumns).from(oAuthClient).orderBy(desc(oAuthClient.createdAt));
  }

  async findClient(clientId: string) {
    const [row] = await this.db
      .select(publicClientColumns)
      .from(oAuthClient)
      .where(eq(oAuthClient.clientId, clientId))
      .limit(1);
    return row ?? null;
  }

  /** Only for checking a client's credentials; the hash never leaves the server. */
  async findClientSecretHash(clientId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ clientSecret: oAuthClient.clientSecret })
      .from(oAuthClient)
      .where(eq(oAuthClient.clientId, clientId))
      .limit(1);
    return row?.clientSecret ?? null;
  }

  async deleteClient(clientId: string): Promise<void> {
    await this.db.delete(oAuthClient).where(eq(oAuthClient.clientId, clientId));
  }

  async createCode(data: {
    code: string;
    clientId: string;
    userId: number;
    scopes: AccessScope[];
    expiresAt: Date;
    codeChallenge: string | null;
    codeChallengeMethod: string | null;
  }): Promise<void> {
    await this.db.insert(accessCode).values(data);
  }

  /**
   * Takes a code for use: returns it if still valid and deletes it in the same batch, with any
   * expired codes, so a code works once.
   */
  async takeCode(code: string, clientId: string, now: Date) {
    const match = and(eq(accessCode.code, code), eq(accessCode.clientId, clientId));
    const [[found]] = await this.db.batch([
      this.db
        .select({
          userId: accessCode.userId,
          scopes: accessCode.scopes,
          codeChallenge: accessCode.codeChallenge,
          codeChallengeMethod: accessCode.codeChallengeMethod,
        })
        .from(accessCode)
        .where(and(match, gt(accessCode.expiresAt, now)))
        .limit(1),
      this.db.delete(accessCode).where(or(match, lte(accessCode.expiresAt, now))),
    ]);
    return found ?? null;
  }
}

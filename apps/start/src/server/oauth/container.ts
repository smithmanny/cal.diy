import "@tanstack/react-start/server-only";
import { encryptionKey } from "../crypto/encryptionKey";
import { getDb } from "../db";
import { OAuthRepository } from "./OAuthRepository";
import { OAuthService } from "./OAuthService";

export async function getOAuthService(): Promise<OAuthService> {
  return new OAuthService({ repo: new OAuthRepository(await getDb()), secret: encryptionKey() });
}

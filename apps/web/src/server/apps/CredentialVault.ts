import { symmetricDecrypt, symmetricEncrypt } from "../crypto/symmetric";

export type StoredCredentialKey = { key: unknown; encryptedKey: string | null };

/** Encrypts credential keys with CALENDSO_ENCRYPTION_KEY in Cal's format, and reads Cal's older layouts. */
export class CredentialVault {
  constructor(private readonly encryptionKey: string) {}

  seal(key: unknown): Promise<string> {
    return symmetricEncrypt(JSON.stringify(key), this.encryptionKey);
  }

  async open(row: StoredCredentialKey): Promise<unknown> {
    if (row.encryptedKey) return JSON.parse(await symmetricDecrypt(row.encryptedKey, this.encryptionKey));
    // Cal's CalDAV and Apple apps keep the encrypted JSON in `key` itself.
    if (typeof row.key === "string") return JSON.parse(await symmetricDecrypt(row.key, this.encryptionKey));
    // Older Cal credentials (OAuth tokens) are plaintext in `key`.
    return row.key;
  }
}

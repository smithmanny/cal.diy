import { hashPassword, verifyPassword } from "better-auth/crypto";
import { isBcryptHash, verifyBcrypt } from "./bcrypt";

type PasswordCheck = { hash: string; password: string };

/**
 * Better Auth's password check, extended to the bcrypt hashes users imported from Cal still have.
 * A bcrypt match is upgraded to Better Auth's scrypt hash, so each user pays bcrypt's cost once.
 */
export function createPasswordVerifier(replaceHash: (oldHash: string, newHash: string) => Promise<void>) {
  return async ({ hash, password }: PasswordCheck): Promise<boolean> => {
    if (!isBcryptHash(hash)) return verifyPassword({ hash, password });
    if (!verifyBcrypt(password, hash)) return false;
    try {
      await replaceHash(hash, await hashPassword(password));
    } catch (error) {
      // The password was right; failing to upgrade the hash only means bcrypt runs again next time.
      console.error("Could not upgrade a bcrypt password hash", error);
    }
    return true;
  };
}

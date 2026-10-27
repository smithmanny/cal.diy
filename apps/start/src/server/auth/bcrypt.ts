import { BLOWFISH_P, BLOWFISH_S } from "./blowfish-constants";

// Verifies the bcrypt hashes Cal stored in UserPassword, so imported users keep their passwords.
// Pure JS (no native module), since it has to run on Workers too. Only verification is needed:
// a successful sign-in replaces the hash with Better Auth's scrypt one.

const BCRYPT_ALPHABET = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const BCRYPT_HASH = /^\$2[abxy]\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/;
const SALT_BYTES = 16;
const HASH_BYTES = 23;
// Bcrypt reads at most 72 bytes of the password, NUL terminator included.
const MAX_KEY_BYTES = 72;
// "OrpheanBeholderScryDoubt", the block bcrypt encrypts 64 times with the expensive key.
const MAGIC = [0x4f727068, 0x65616e42, 0x65686f6c, 0x64657253, 0x63727944, 0x6f756274];

function decodeBase64(text: string, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of text) {
    buffer = (buffer << 6) | BCRYPT_ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (index < length) bytes[index++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let text = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      text += BCRYPT_ALPHABET[(buffer >> bits) & 0x3f];
    }
  }
  if (bits > 0) text += BCRYPT_ALPHABET[(buffer << (6 - bits)) & 0x3f];
  return text;
}

class Blowfish {
  readonly p = Int32Array.from(BLOWFISH_P);
  readonly s = Int32Array.from(BLOWFISH_S);
  private readonly block = new Int32Array(2);

  private f(x: number): number {
    const s = this.s;
    return (
      (((s[x >>> 24] + s[256 | ((x >>> 16) & 0xff)]) ^ s[512 | ((x >>> 8) & 0xff)]) + s[768 | (x & 0xff)]) | 0
    );
  }

  /** Encrypts the pair in `this.block` in place. */
  private encipher(): void {
    const p = this.p;
    let left = this.block[0] ^ p[0];
    let right = this.block[1];
    for (let i = 1; i <= 16; i += 2) {
      right ^= this.f(left) ^ p[i];
      left ^= this.f(right) ^ p[i + 1];
    }
    this.block[0] = right ^ p[17];
    this.block[1] = left;
  }

  encryptPair(words: Int32Array, offset: number): void {
    this.block[0] = words[offset];
    this.block[1] = words[offset + 1];
    this.encipher();
    words[offset] = this.block[0];
    words[offset + 1] = this.block[1];
  }

  /** Blowfish key schedule, optionally mixing in the salt as bcrypt's EksBlowfishSetup does. */
  expand(key: Uint8Array, salt?: Uint8Array): void {
    const keyStream = cyclicWords(key);
    for (let i = 0; i < 18; i++) this.p[i] ^= keyStream();
    const saltStream = salt ? cyclicWords(salt) : () => 0;
    this.block[0] = 0;
    this.block[1] = 0;
    for (const table of [this.p, this.s]) {
      for (let i = 0; i < table.length; i += 2) {
        this.block[0] ^= saltStream();
        this.block[1] ^= saltStream();
        this.encipher();
        table[i] = this.block[0];
        table[i + 1] = this.block[1];
      }
    }
  }
}

/** Reads 32-bit big-endian words from `bytes`, wrapping around at the end. */
function cyclicWords(bytes: Uint8Array): () => number {
  let offset = 0;
  return () => {
    let word = 0;
    for (let i = 0; i < 4; i++) {
      word = (word << 8) | bytes[offset];
      offset = (offset + 1) % bytes.length;
    }
    return word;
  };
}

function passwordKey(password: string): Uint8Array {
  const encoded = new TextEncoder().encode(password);
  const key = new Uint8Array(Math.min(encoded.length + 1, MAX_KEY_BYTES));
  key.set(encoded.subarray(0, key.length));
  return key;
}

function bcryptDigest(password: string, cost: number, salt: Uint8Array): Uint8Array {
  const key = passwordKey(password);
  const cipher = new Blowfish();
  cipher.expand(key, salt);
  for (let round = 0; round < 2 ** cost; round++) {
    cipher.expand(key);
    cipher.expand(salt);
  }
  const text = Int32Array.from(MAGIC);
  for (let i = 0; i < 64; i++) {
    for (let j = 0; j < text.length; j += 2) cipher.encryptPair(text, j);
  }
  const output = new Uint8Array(text.length * 4);
  const view = new DataView(output.buffer);
  for (let i = 0; i < text.length; i++) view.setInt32(i * 4, text[i]);
  return output.subarray(0, HASH_BYTES);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export function isBcryptHash(hash: string): boolean {
  return BCRYPT_HASH.test(hash);
}

export function verifyBcrypt(password: string, hash: string): boolean {
  const match = BCRYPT_HASH.exec(hash);
  if (!match) return false;
  const cost = Number(match[1]);
  if (cost < 4 || cost > 31) return false;
  const digest = bcryptDigest(password, cost, decodeBase64(match[2], SALT_BYTES));
  return constantTimeEqual(encodeBase64(digest), match[3]);
}

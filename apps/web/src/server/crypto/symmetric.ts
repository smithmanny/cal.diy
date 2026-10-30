// Cal's symmetricEncrypt/symmetricDecrypt (packages/lib/crypto.ts) reimplemented on WebCrypto so it
// runs on Workers: AES-256-CBC with PKCS#7 padding, output "ivHex:cipherHex", key as 32 latin1 chars.
// Same format means credentials encrypted by Cal decrypt here and vice versa.

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function importKey(key: string): Promise<CryptoKey> {
  const raw = new Uint8Array(new ArrayBuffer(key.length));
  for (let i = 0; i < key.length; i++) raw[i] = key.charCodeAt(i) & 0xff;
  if (raw.length !== 32) throw new Error("The encryption key must be 32 characters (AES-256).");
  return crypto.subtle.importKey("raw", raw, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
}

export async function symmetricEncrypt(text: string, key: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    await importKey(key),
    new TextEncoder().encode(text)
  );
  return `${toHex(iv)}:${toHex(new Uint8Array(cipher))}`;
}

export async function symmetricDecrypt(text: string, key: string): Promise<string> {
  const [ivHex, ...rest] = text.split(":");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: fromHex(ivHex) },
    await importKey(key),
    fromHex(rest.join(":"))
  );
  return new TextDecoder().decode(plain);
}

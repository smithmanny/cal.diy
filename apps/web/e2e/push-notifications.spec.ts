import process from "node:process";
import type { ReceivedPush } from "./support/fake-servers";
import { bookFirstSlot, signUp } from "./support/helpers";
import { E2E_VAPID_PUBLIC_KEY, FAKE_PUSH_PORT } from "./support/ports";
import { expect, newClientContext, test } from "./support/test";

test.skip(Boolean(process.env.E2E_BASE_URL), "needs the dev server's fake push service and VAPID keys");

const { subtle } = globalThis.crypto;

/** A browser's side of a push subscription: its ECDH key pair and auth secret. */
async function browserKeys() {
  const pair = (await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return { pair, publicKey, auth };
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: string | Uint8Array, length: number) {
  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const infoBytes = typeof info === "string" ? new TextEncoder().encode(info) : info;
  return new Uint8Array(
    await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: infoBytes }, key, length * 8)
  );
}

/** What the browser does with an aes128gcm push body (RFC 8291), to check what the server sent. */
async function decrypt(body: Uint8Array, keys: Awaited<ReturnType<typeof browserKeys>>): Promise<string> {
  const salt = body.slice(0, 16);
  const idLength = body[20];
  const senderPublic = body.slice(21, 21 + idLength);
  const senderKey = await subtle.importKey(
    "raw",
    senderPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const shared = new Uint8Array(
    await subtle.deriveBits({ name: "ECDH", public: senderKey }, keys.pair.privateKey, 256)
  );
  const info = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...keys.publicKey,
    ...senderPublic,
  ]);
  const ikm = await hkdf(keys.auth, shared, info, 32);
  const cek = await hkdf(salt, ikm, "Content-Encoding: aes128gcm\0", 16);
  const nonce = await hkdf(salt, ikm, "Content-Encoding: nonce\0", 12);
  const aes = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(
    await subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, body.slice(21 + idLength))
  );
  return new TextDecoder().decode(plain.slice(0, plain.lastIndexOf(2)));
}

test("hosts turn on browser notifications and get an encrypted push for a new booking", async ({
  page,
  browser,
  request,
}) => {
  const keys = await browserKeys();
  const endpoint = `http://localhost:${FAKE_PUSH_PORT}/push/${crypto.randomUUID()}`;
  // Headless Chromium has no push service, so the page gets a stand-in PushManager whose
  // subscription points at the fake one, with keys this test can decrypt with.
  await page.addInitScript(
    ({ endpoint, p256dh, auth }) => {
      let current: { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> } | null =
        null;
      const pushManager = {
        getSubscription: async () => current,
        subscribe: async () => {
          current = {
            endpoint,
            toJSON: () => ({ endpoint, keys: { p256dh, auth } }),
            unsubscribe: async () => {
              current = null;
              return true;
            },
          };
          return current;
        },
      };
      const registration = { pushManager };
      Object.defineProperty(navigator, "serviceWorker", {
        value: { register: async () => registration, ready: Promise.resolve(registration) },
      });
      Object.defineProperty(window, "Notification", { value: { requestPermission: async () => "granted" } });
    },
    {
      endpoint,
      p256dh: Buffer.from(keys.publicKey).toString("base64url"),
      auth: Buffer.from(keys.auth).toString("base64url"),
    }
  );
  const { username } = await signUp(page);
  await page.goto("/settings/my-account/push-notifications");
  await page.getByRole("button", { name: "Allow browser notifications" }).click();
  await expect(page.getByRole("status")).toHaveText("Browser notifications turned on");

  const guest = await (await newClientContext(browser)).newPage();
  await bookFirstSlot(guest, username, "30min");

  let push: ReceivedPush | undefined;
  await expect
    .poll(async () => {
      const received: ReceivedPush[] = await (
        await request.get(`http://localhost:${FAKE_PUSH_PORT}/received`)
      ).json();
      push = received.find((entry) => endpoint.endsWith(entry.path));
      return Boolean(push);
    })
    .toBe(true);
  expect(push?.headers["content-encoding"]).toBe("aes128gcm");
  expect(push?.headers.authorization).toMatch(new RegExp(`^vapid t=.+, k=${E2E_VAPID_PUBLIC_KEY}$`));
  const message = JSON.parse(await decrypt(Buffer.from(push?.body ?? "", "base64url"), keys));
  expect(message).toMatchObject({
    title: "A new event has been scheduled.",
    body: expect.stringContaining("30 min meeting"),
    data: { url: expect.stringContaining("/bookings/upcoming") },
  });

  await page.getByRole("button", { name: "Disable browser notifications" }).click();
  await expect(page.getByRole("status")).toHaveText("Browser notifications turned off");
});

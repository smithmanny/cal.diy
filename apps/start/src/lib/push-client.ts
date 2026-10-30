/** Browser side of web push: the service worker, permission and PushManager subscription. */

function applicationServerKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const base64 = publicKey.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const key = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) key[index] = binary.charCodeAt(index);
  return key;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/service-worker.js");
  return navigator.serviceWorker.ready;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  return (await registration()).pushManager.getSubscription();
}

/** Asks for permission and subscribes; null when the user said no. */
export async function subscribeBrowser(publicKey: string): Promise<PushSubscriptionJSON | null> {
  if ((await Notification.requestPermission()) !== "granted") return null;
  const subscription = await (await registration()).pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(publicKey),
  });
  return subscription.toJSON();
}

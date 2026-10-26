import { startFakeGoogle, startWebhookReceiver } from "./fake-servers";

export const WEBHOOK_RECEIVER_PORT = 3299;
export const FAKE_GOOGLE_PORT = 3298;

export default async function globalSetup() {
  const servers = [startWebhookReceiver(WEBHOOK_RECEIVER_PORT), startFakeGoogle(FAKE_GOOGLE_PORT)];
  return async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  };
}

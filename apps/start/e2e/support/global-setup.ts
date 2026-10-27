import { startFakeGoogle, startFakeResend, startWebhookReceiver } from "./fake-servers";
import { FAKE_GOOGLE_PORT, FAKE_RESEND_PORT, WEBHOOK_RECEIVER_PORT } from "./ports";

export default async function globalSetup() {
  const servers = [
    startWebhookReceiver(WEBHOOK_RECEIVER_PORT),
    startFakeGoogle(FAKE_GOOGLE_PORT),
    startFakeResend(FAKE_RESEND_PORT),
  ];
  return async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  };
}

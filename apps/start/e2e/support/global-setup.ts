import { startFakeApps } from "./fake-apps-server";
import { startFakeGoogle, startFakePushService, startFakeResend, startWebhookReceiver } from "./fake-servers";
import {
  FAKE_APPS_PORT,
  FAKE_GOOGLE_PORT,
  FAKE_PUSH_PORT,
  FAKE_RESEND_PORT,
  WEBHOOK_RECEIVER_PORT,
} from "./ports";

export default async function globalSetup() {
  const servers = [
    startWebhookReceiver(WEBHOOK_RECEIVER_PORT),
    startFakeGoogle(FAKE_GOOGLE_PORT),
    startFakeResend(FAKE_RESEND_PORT),
    startFakePushService(FAKE_PUSH_PORT),
    startFakeApps(FAKE_APPS_PORT),
  ];
  return async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  };
}

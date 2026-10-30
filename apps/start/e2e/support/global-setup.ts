import { startFakeApps } from "./fake-apps-server";
import { startFakeGoogle, startFakePushService, startFakeResend, startWebhookReceiver } from "./fake-servers";
import { startFakeStripe } from "./fake-stripe-server";
import {
  APP_PORT,
  FAKE_APPS_PORT,
  FAKE_GOOGLE_PORT,
  FAKE_PUSH_PORT,
  FAKE_RESEND_PORT,
  FAKE_STRIPE_PORT,
  STRIPE_WEBHOOK_SECRET,
  WEBHOOK_RECEIVER_PORT,
} from "./ports";

export default async function globalSetup() {
  const servers = [
    startWebhookReceiver(WEBHOOK_RECEIVER_PORT),
    startFakeGoogle(FAKE_GOOGLE_PORT),
    startFakeResend(FAKE_RESEND_PORT),
    startFakePushService(FAKE_PUSH_PORT),
    startFakeApps(FAKE_APPS_PORT),
    startFakeStripe(
      FAKE_STRIPE_PORT,
      `http://localhost:${APP_PORT}/api/integrations/stripepayment/webhook`,
      STRIPE_WEBHOOK_SECRET
    ),
  ];
  return async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  };
}

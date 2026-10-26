import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";

export const WEBHOOK_SECRET = "e2e-webhook-secret";

export type ReceivedWebhook = {
  trigger: string;
  signatureValid: boolean;
  version: string | undefined;
  uid?: string;
  location?: string;
};

/** Accepts webhooks, verifies Cal's signature, and lists what it got at GET /received. */
export function startWebhookReceiver(port: number): Server {
  const received: ReceivedWebhook[] = [];
  return createServer((req, res) => {
    if (req.method === "GET" && req.url === "/received") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(received));
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const parsed = JSON.parse(body);
      received.push({
        trigger: parsed.triggerEvent,
        signatureValid:
          req.headers["x-cal-signature-256"] ===
          createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex"),
        version: req.headers["x-cal-webhook-version"] as string | undefined,
        uid: parsed.payload?.uid,
        location: parsed.payload?.location,
      });
      res.end("ok");
    });
  }).listen(port);
}

/** Google's OAuth consent/token endpoints and the bits of Calendar API the app uses. */
export function startFakeGoogle(port: number): Server {
  let counter = 0;
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    req.resume();
    req.on("end", () => {
      const json = (data: unknown, status = 200) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      };
      if (url.pathname === "/auth") {
        // The consent screen approves immediately.
        const back = new URL(url.searchParams.get("redirect_uri") ?? "");
        back.searchParams.set("code", "fake-code");
        back.searchParams.set("state", url.searchParams.get("state") ?? "");
        res.writeHead(302, { Location: back.href });
        res.end();
        return;
      }
      if (url.pathname === "/token")
        return json({
          access_token: `at-${++counter}`,
          refresh_token: "rt",
          expires_in: 3600,
          token_type: "Bearer",
        });
      if (url.pathname === "/revoke") return json({});
      if (url.pathname === "/calendar/v3/users/me/calendarList") {
        return json({
          items: [
            { id: "me@example.com", summary: "My calendar", primary: true, accessRole: "owner" },
            { id: "family@group", summary: "Family", accessRole: "reader" },
          ],
        });
      }
      if (url.pathname === "/calendar/v3/freeBusy")
        return json({ calendars: { "me@example.com": { busy: [] } } });
      if (/^\/calendar\/v3\/calendars\/[^/]+\/events/.test(url.pathname)) {
        if (req.method === "POST")
          return json({ id: `evt-${++counter}`, hangoutLink: `https://meet.google.com/e2e-${counter}` });
        res.writeHead(204);
        res.end();
        return;
      }
      json({ error: `unknown ${url.pathname}` }, 404);
    });
  }).listen(port);
}

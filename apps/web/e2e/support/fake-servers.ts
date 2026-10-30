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

/** The fake holiday: the first weekday from the 15th of next month (UTC), as YYYY-MM-DD. */
export function fakeHolidayDate(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
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
      // Public holiday calendars are read with an API key; one holiday next month is enough.
      if (req.method === "GET" && url.pathname.includes("%23holiday")) {
        const holiday = fakeHolidayDate();
        const year = url.searchParams.get("timeMin")?.slice(0, 4);
        return json({
          items: holiday.startsWith(`${year}-`)
            ? [{ id: "e2e-founders-day", summary: "Founders Day", start: { date: holiday } }]
            : [],
        });
      }
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

export type CapturedEmail = { to: string[]; subject: string; html: string; text: string };

/** Stands in for Resend: keeps every email and lists them at GET /emails?to=<address>. */
export function startFakeResend(port: number): Server {
  const emails: CapturedEmail[] = [];
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    if (req.method === "GET" && url.pathname === "/emails") {
      const to = url.searchParams.get("to");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(emails.filter((email) => !to || email.to.includes(to))));
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const { to, subject, html, text } = JSON.parse(body);
      emails.push({ to, subject, html, text });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ id: `email-${emails.length}` }));
    });
  }).listen(port);
}

export type ReceivedPush = { path: string; headers: Record<string, string>; body: string };

/** Stands in for a browser's push service: records each delivery, listed at GET /received. */
export function startFakePushService(port: number): Server {
  const received: ReceivedPush[] = [];
  return createServer((req, res) => {
    if (req.method === "GET" && req.url === "/received") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(received));
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received.push({
        path: req.url ?? "",
        headers: {
          authorization: String(req.headers.authorization ?? ""),
          "content-encoding": String(req.headers["content-encoding"] ?? ""),
          ttl: String(req.headers.ttl ?? ""),
        },
        body: Buffer.concat(chunks).toString("base64url"),
      });
      res.statusCode = 201;
      res.end();
    });
  }).listen(port);
}

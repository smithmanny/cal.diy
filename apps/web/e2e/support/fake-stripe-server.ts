import { createServer, type Server } from "node:http";
import { createFakeStripeState, handleFakeStripe } from "../../src/server/payments/stripe/fakeStripe";

/** Stripe on localhost (see fakeStripe.ts); GET /control/refunds lists the refunds made. */
export function startFakeStripe(port: number, webhookUrl: string, webhookSecret: string): Server {
  const state = createFakeStripeState(webhookUrl, webhookSecret);
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      if (url.pathname === "/control/refunds") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(state.refunds));
        return;
      }
      const result = await handleFakeStripe(state, {
        method: req.method ?? "GET",
        path: url.pathname,
        query: url.searchParams,
        body,
        account: req.headers["stripe-account"]?.toString() ?? null,
        authorization: req.headers.authorization ?? null,
        origin: `http://localhost:${port}`,
      });
      if (result.location) {
        res.writeHead(result.status, { Location: result.location });
        res.end();
        return;
      }
      res.writeHead(result.status, { "Content-Type": result.html ? "text/html" : "application/json" });
      res.end(result.html ?? JSON.stringify(result.json ?? {}));
    });
  }).listen(port);
}

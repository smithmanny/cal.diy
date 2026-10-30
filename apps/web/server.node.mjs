// Production entry for Docker / any Node host. `vite build` emits a fetch handler and
// static assets; srvx serves both without pulling in a full server framework.

import process from "node:process";
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import server from "./dist/server/server.js";

// X-Forwarded-For is only believed from proxies listed here, otherwise anyone could pick the IP
// that sign-in rate limits are keyed on. "loopback" suits a reverse proxy on the same host; for one
// in another container, list its address.
function trustProxy(value) {
  if (!value || value === "false") return false;
  if (value === "true") return true;
  if (value === "loopback") return "loopback";
  return value.split(",").map((entry) => entry.trim());
}

// Cal's scheduling code (slots, booking limits, date overrides) assumes the process runs in UTC,
// as Cal's own servers and Workers do; on a server set to local time, limits and day boundaries
// would shift. Every time zone the app works in is explicit.
process.env.TZ = "UTC";

serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: process.env.HOST ?? "0.0.0.0",
  trustProxy: trustProxy(process.env.TRUST_PROXY),
  middleware: [staticMiddleware({ dir: new URL("./dist/client", import.meta.url).pathname, maxAge: 0 })],
  fetch(request) {
    // Overwrites whatever the client sent; see CLIENT_IP_HEADERS in src/server/runtime/node.ts.
    if (request.ip) request.headers.set("x-cal-client-ip", request.ip);
    else request.headers.delete("x-cal-client-ip");
    return server.fetch(request);
  },
});

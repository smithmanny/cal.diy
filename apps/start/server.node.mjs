// Production entry for Docker / any Node host. `vite build` emits a fetch handler and
// static assets; srvx serves both without pulling in a full server framework.

import process from "node:process";
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import server from "./dist/server/server.js";

serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: process.env.HOST ?? "0.0.0.0",
  middleware: [staticMiddleware({ dir: new URL("./dist/client", import.meta.url).pathname, maxAge: 0 })],
  fetch: server.fetch,
});

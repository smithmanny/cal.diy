import { createServer, type Server } from "node:http";
import { createFakeAppsState, handleFakeApps } from "../../src/server/apps/fakeApps";
import { createFakeCalDavState, handleFakeCalDav } from "../../src/server/calendars/caldav/fakeCalDav";

/**
 * Microsoft, Zoom and Daily (see FAKE_APP_PATHS) and a CalDAV server under /dav/, on one port.
 * PUT /control/caldav-busy replaces the CalDAV calendar's busy times with the JSON body.
 */
export function startFakeApps(port: number): Server {
  const apps = createFakeAppsState();
  const calDav = createFakeCalDavState();
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (url.pathname === "/control/caldav-busy") {
        calDav.busy = JSON.parse(body);
        res.end("ok");
        return;
      }
      if (url.pathname.startsWith("/dav/")) {
        const result = handleFakeCalDav(calDav, {
          method: req.method ?? "GET",
          path: url.pathname,
          depth: req.headers.depth?.toString() ?? null,
          authorization: req.headers.authorization ?? null,
          body,
        });
        res.writeHead(result.status, result.contentType ? { "Content-Type": result.contentType } : {});
        res.end(result.body);
        return;
      }
      url.searchParams.set("origin", `http://localhost:${port}`);
      const result = handleFakeApps(apps, {
        method: req.method ?? "GET",
        path: url.pathname,
        query: url.searchParams,
        body,
        authorization: req.headers.authorization ?? null,
      });
      if (result.location) {
        res.writeHead(result.status, { Location: result.location });
        res.end();
        return;
      }
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(result.body === undefined ? "" : JSON.stringify(result.body));
    });
  }).listen(port);
}

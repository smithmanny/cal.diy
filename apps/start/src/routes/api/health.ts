import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { getDb } from "~/server/db";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const db = await getDb();
        await db.run(sql`select 1`);
        return Response.json({ status: "ok" });
      },
    },
  },
});

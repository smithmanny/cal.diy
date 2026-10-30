import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "~/server/auth/auth";

async function handle({ request }: { request: Request }) {
  const auth = await getAuth();
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: handle, POST: handle } },
});

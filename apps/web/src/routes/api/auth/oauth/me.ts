import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "~/server/db";
import { getOAuthService } from "~/server/oauth/container";
import { UserRepository } from "~/server/users/UserRepository";

/** Cal's OAuth "who is this" endpoint, for tokens with READ_PROFILE. */
async function me({ request }: { request: Request }): Promise<Response> {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const claims = await (await getOAuthService()).verifyAccessToken(token);
  if (!claims?.scope.includes("READ_PROFILE"))
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  const profile = await new UserRepository(await getDb()).findProfile(claims.userId);
  if (!profile) return Response.json({ message: "Unauthorized" }, { status: 401 });
  return Response.json({ username: profile.username }, { status: 201 });
}

export const Route = createFileRoute("/api/auth/oauth/me")({
  server: { handlers: { GET: me, POST: me } },
});

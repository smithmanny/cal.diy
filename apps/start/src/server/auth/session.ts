import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "./auth";

export type SessionUser = {
  id: number;
  email: string;
  name: string | null;
  username: string | null;
};

export const getSessionUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: getRequestHeaders() });
    if (!session) return null;
    const { id, email, name, username } = session.user;
    return { id: Number(id), email, name: name || null, username: username ?? null };
  }
);

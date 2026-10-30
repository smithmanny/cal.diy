/**
 * Where to land after connecting a calendar. Onboarding connects one too and wants its next step
 * back, so the path rides in a short-lived cookie through the OAuth round trip.
 */
const COOKIE = "cal_calendar_return";
const ALLOWED = new Set(["/getting-started/connected-calendar"]);

export function returnCookie(path: string | null): string | null {
  if (!path || !ALLOWED.has(path)) return null;
  return `${COOKIE}=${encodeURIComponent(path)}; Path=/api/integrations; Max-Age=600; HttpOnly; SameSite=Lax`;
}

export function clearReturnCookie(): string {
  return `${COOKIE}=; Path=/api/integrations; Max-Age=0; HttpOnly; SameSite=Lax`;
}

/** The page to go back to: the allowed path the cookie names, else the app's own page. */
export function returnPath(cookieHeader: string | null, fallback: string): string {
  const value = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  const path = value ? decodeURIComponent(value) : null;
  return path && ALLOWED.has(path) ? path : fallback;
}

export function redirectResponse(location: string, setCookie: string | null): Response {
  const headers = new Headers({ location });
  if (setCookie) headers.append("set-cookie", setCookie);
  return new Response(null, { status: 302, headers });
}

import "@tanstack/react-start/server-only";
import { getOAuthService } from "./container";
import { OAuthError, type OAuthService } from "./OAuthService";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

/** Token endpoint parameters, form-encoded as RFC 6749 says, or JSON as some clients send. */
export async function tokenParams(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  const entries: [string, unknown][] = type.includes("application/json")
    ? Object.entries((await request.json().catch(() => ({}))) as Record<string, unknown>)
    : [...(await request.formData().catch(() => new FormData())).entries()];
  const params: Record<string, string> = {};
  for (const [key, value] of entries) if (typeof value === "string") params[key] = value;
  // RFC 6749 2.3.1: confidential clients may authenticate with HTTP Basic instead.
  const basic = /^Basic\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (basic) {
    const [id, secret] = atob(basic).split(":").map(decodeURIComponent);
    params.client_id ??= id;
    params.client_secret ??= secret;
  }
  return params;
}

/** Runs a token endpoint, answering OAuth errors in RFC 6749's shape. */
export async function tokenResponse(
  request: Request,
  issue: (service: OAuthService, params: Record<string, string>) => Promise<object>
): Promise<Response> {
  try {
    const params = await tokenParams(request);
    return Response.json(await issue(await getOAuthService(), params), { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof OAuthError)) throw error;
    return Response.json(
      { error: error.error, error_description: error.description },
      { status: error.status, headers: NO_STORE }
    );
  }
}

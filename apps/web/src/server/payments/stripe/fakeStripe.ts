// An in-memory Stripe for tests: Connect OAuth, Checkout sessions with a pay page, refunds, and
// signed webhooks to the app. Paths are Stripe's under `/v1` and `/connect`; `/checkout/<id>` is
// the hosted page. Served through `fetch` in unit tests and over HTTP in e2e.
import { signStripePayload } from "./signature";

type FakeSession = {
  id: string;
  account: string | null;
  url: string;
  status: string;
  payment_status: string;
  payment_intent: string | null;
  expires_at: number;
  amount_total: number;
  currency: string;
  customer_email: string | null;
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
};

type FakeStripeState = {
  sessions: Map<string, FakeSession>;
  refunds: { account: string | null; payment_intent: string }[];
  calls: { method: string; path: string; account: string | null; authorization: string | null }[];
  /** Where paid sessions are announced, signed with `webhookSecret`; null skips the webhook. */
  webhookUrl: string | null;
  webhookSecret: string;
};

type FakeRequest = {
  method: string;
  path: string;
  query: URLSearchParams;
  body: string;
  account: string | null;
  authorization: string | null;
  origin: string;
};

type FakeResponse = { status: number; json?: unknown; html?: string; location?: string };

let counter = 0;

/** Stripe's `a[b][c]=v` form fields as nested objects. */
function parseForm(body: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, value] of new URLSearchParams(body)) {
    const keys = name.split(/\[|\]\[|\]/).filter(Boolean);
    let node = result;
    for (const [index, key] of keys.entries()) {
      if (index === keys.length - 1) node[key] = value;
      else {
        node[key] ??= {};
        node = node[key] as Record<string, unknown>;
      }
    }
  }
  return result;
}

function createSession(state: FakeStripeState, request: FakeRequest): FakeResponse {
  const form = parseForm(request.body) as {
    success_url: string;
    cancel_url: string;
    customer_email?: string;
    metadata?: Record<string, string>;
    line_items: { 0: { price_data: { currency: string; unit_amount: string } } };
  };
  const id = `cs_test_${++counter}`;
  const session: FakeSession = {
    id,
    account: request.account,
    url: `${request.origin}/checkout/${id}`,
    status: "open",
    payment_status: "unpaid",
    payment_intent: null,
    expires_at: Math.floor(Date.now() / 1000) + 86_400,
    amount_total: Number(form.line_items[0].price_data.unit_amount),
    currency: form.line_items[0].price_data.currency,
    customer_email: form.customer_email ?? null,
    success_url: form.success_url,
    cancel_url: form.cancel_url,
    metadata: form.metadata ?? {},
  };
  state.sessions.set(id, session);
  return { status: 200, json: session };
}

/** The booker pays: the session completes, the app hears about it, and the booker goes back. */
async function pay(state: FakeStripeState, id: string, fetchImpl: typeof fetch): Promise<FakeResponse> {
  const session = state.sessions.get(id);
  if (!session) return { status: 404, json: { error: { message: "No such session" } } };
  Object.assign(session, {
    status: "complete",
    payment_status: "paid",
    payment_intent: `pi_test_${++counter}`,
  });
  if (state.webhookUrl) {
    const payload = JSON.stringify({
      id: `evt_${++counter}`,
      type: "checkout.session.completed",
      account: session.account,
      data: { object: session },
    });
    await fetchImpl(state.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": await signStripePayload(payload, state.webhookSecret),
      },
      body: payload,
    });
  }
  return { status: 303, location: session.success_url };
}

function checkoutPage(state: FakeStripeState, id: string): FakeResponse {
  const session = state.sessions.get(id);
  if (!session) return { status: 404, html: "Not found" };
  const amount = `${(session.amount_total / 100).toFixed(2)} ${session.currency.toUpperCase()}`;
  return {
    status: 200,
    html: `<!doctype html><title>Fake Checkout</title><h1>Pay ${amount}</h1><form method="post" action="/checkout/${id}/pay"><button>Pay</button></form><a href="${session.cancel_url}">Back</a>`,
  };
}

function connect(request: FakeRequest, path: string): FakeResponse | null {
  if (path === "/connect/oauth/authorize") {
    const back = new URL(request.query.get("redirect_uri") ?? "");
    back.searchParams.set("code", "ac_fake");
    back.searchParams.set("state", request.query.get("state") ?? "");
    return { status: 302, location: back.href };
  }
  if (path === "/connect/oauth/token")
    return {
      status: 200,
      json: {
        access_token: "sk_test_connected",
        refresh_token: "rt_fake",
        stripe_user_id: `acct_fake_${++counter}`,
        stripe_publishable_key: "pk_test_fake",
        livemode: false,
        scope: "read_write",
        token_type: "bearer",
      },
    };
  const account = path.match(/^\/v1\/accounts\/([^/]+)$/);
  if (account) return { status: 200, json: { id: account[1], default_currency: "usd" } };
  return null;
}

export function createFakeStripeState(
  webhookUrl: string | null = null,
  webhookSecret = "whsec_test"
): FakeStripeState {
  return { sessions: new Map(), refunds: [], calls: [], webhookUrl, webhookSecret };
}

export async function handleFakeStripe(
  state: FakeStripeState,
  request: FakeRequest,
  fetchImpl: typeof fetch = fetch
): Promise<FakeResponse> {
  const { path, method } = request;
  state.calls.push({ method, path, account: request.account, authorization: request.authorization });
  const connected = connect(request, path);
  if (connected) return connected;
  if (path === "/v1/checkout/sessions" && method === "POST") return createSession(state, request);
  const session = path.match(/^\/v1\/checkout\/sessions\/([^/]+)$/);
  if (session) {
    const found = state.sessions.get(session[1]);
    return found
      ? { status: 200, json: found }
      : { status: 404, json: { error: { message: "No such session" } } };
  }
  if (path === "/v1/refunds" && method === "POST") {
    const form = parseForm(request.body) as { payment_intent: string };
    state.refunds.push({ account: request.account, payment_intent: form.payment_intent });
    return { status: 200, json: { id: `re_${++counter}`, status: "succeeded" } };
  }
  const page = path.match(/^\/checkout\/([^/]+)(\/pay)?$/);
  if (page?.[2] && method === "POST") return pay(state, page[1], fetchImpl);
  if (page) return checkoutPage(state, page[1]);
  return { status: 404, json: { error: { message: `Unknown ${method} ${path}` } } };
}

/** The fake as a `fetch` on `origin`, for unit tests; webhooks go out through `deliver`. */
export function fakeStripeFetch(
  state: FakeStripeState,
  origin = "https://stripe.test",
  deliver: typeof fetch = fetch
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const headers = new Headers(init?.headers);
    const result = await handleFakeStripe(
      state,
      {
        method: init?.method ?? "GET",
        path: url.pathname,
        query: url.searchParams,
        body: typeof init?.body === "string" ? init.body : "",
        account: headers.get("Stripe-Account"),
        authorization: headers.get("Authorization"),
        origin,
      },
      deliver
    );
    if (result.location)
      return new Response(null, { status: result.status, headers: { Location: result.location } });
    return new Response(result.html ?? JSON.stringify(result.json ?? {}), {
      status: result.status,
      headers: { "Content-Type": result.html ? "text/html" : "application/json" },
    });
  }) as typeof fetch;
}

export type { FakeRequest, FakeResponse, FakeSession, FakeStripeState };

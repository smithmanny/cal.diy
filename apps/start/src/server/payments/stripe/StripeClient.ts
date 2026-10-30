/**
 * The parts of Stripe's API Cal.diy uses, over fetch (the stripe package needs Node). Calls are
 * made with the platform's secret key on behalf of the host's connected account (Stripe Connect).
 */

type StripeConfig = {
  /** STRIPE_PRIVATE_KEY: the platform's secret key. */
  secretKey: string;
  /** STRIPE_CLIENT_ID: the Connect platform's client id (ca_…). */
  clientId: string;
  apiUrl: string;
  connectUrl: string;
};

/** Cal's credential.key for Stripe: Connect's token response plus the account's currency. */
type StripeConnectKey = {
  stripe_user_id: string;
  stripe_publishable_key: string;
  default_currency: string;
  access_token?: string;
  refresh_token?: string;
  livemode?: boolean;
  scope?: string;
};

type CheckoutSession = {
  id: string;
  url: string | null;
  status: string;
  payment_status: string;
  payment_intent: string | null;
  expires_at: number;
};

type CheckoutInput = {
  account: string;
  amount: number;
  currency: string;
  productName: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
};

/** Stripe's form encoding, with nested objects as `a[b][c]`. */
function encodeForm(params: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(params).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) return [];
    if (typeof value === "object") return encodeForm(value as Record<string, unknown>, name);
    return [`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`];
  });
}

class StripeClient {
  constructor(
    private readonly config: StripeConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  /** Stripe Connect's consent screen (Standard accounts, as in Cal). */
  authorizeUrl(state: string, redirectUri: string, user: { email: string; name: string | null }): string {
    const url = new URL(`${this.config.connectUrl}/oauth/authorize`);
    url.search = encodeForm({
      response_type: "code",
      client_id: this.config.clientId,
      scope: "read_write",
      redirect_uri: redirectUri,
      state,
      stripe_user: { email: user.email, first_name: user.name ?? undefined },
    }).join("&");
    return url.toString();
  }

  async connect(code: string): Promise<StripeConnectKey> {
    const token = await this.request<Omit<StripeConnectKey, "default_currency">>(
      `${this.config.connectUrl}/oauth/token`,
      { grant_type: "authorization_code", code }
    );
    const account = await this.request<{ default_currency?: string }>(
      `${this.config.apiUrl}/accounts/${encodeURIComponent(token.stripe_user_id)}`,
      undefined,
      "GET"
    );
    return { ...token, default_currency: account.default_currency ?? "" };
  }

  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
    return this.request<CheckoutSession>(
      `${this.config.apiUrl}/checkout/sessions`,
      {
        mode: "payment",
        customer_email: input.customerEmail || undefined,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        line_items: {
          0: {
            quantity: 1,
            price_data: {
              currency: input.currency,
              unit_amount: input.amount,
              product_data: { name: input.productName },
            },
          },
        },
        metadata: input.metadata,
        payment_intent_data: { metadata: input.metadata },
      },
      "POST",
      input.account
    );
  }

  retrieveCheckoutSession(account: string, id: string): Promise<CheckoutSession> {
    return this.request<CheckoutSession>(
      `${this.config.apiUrl}/checkout/sessions/${encodeURIComponent(id)}`,
      undefined,
      "GET",
      account
    );
  }

  refund(account: string, paymentIntent: string): Promise<{ id: string; status: string }> {
    return this.request(`${this.config.apiUrl}/refunds`, { payment_intent: paymentIntent }, "POST", account);
  }

  private async request<T>(
    url: string,
    params: Record<string, unknown> | undefined,
    method = "POST",
    account?: string
  ): Promise<T> {
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        ...(params && { "Content-Type": "application/x-www-form-urlencoded" }),
        ...(account && { "Stripe-Account": account }),
      },
      body: params ? encodeForm(params).join("&") : undefined,
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(
        `Stripe ${method} ${new URL(url).pathname} failed with ${response.status}: ${error?.error?.message ?? ""}`
      );
    }
    return (await response.json()) as T;
  }
}

export { encodeForm, StripeClient };
export type { CheckoutSession, StripeConfig, StripeConnectKey };

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import process from "node:process";
import type { Page } from "@playwright/test";
import { makeAdmin } from "./support/db";
import { signUp } from "./support/helpers";
import { expect, newClientContext, test } from "./support/test";

test.skip(Boolean(process.env.E2E_BASE_URL), "makes an admin in the dev server's database");

/** The third-party app's redirect URI: a real server, like an app would run. */
async function callbackServer() {
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end("<h1>Back at the app</h1>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/callback`, close: () => server.close() };
}

async function createClient(page: Page, redirectUri: string) {
  await page.goto("/settings/admin/oauth");
  await page.getByLabel("Name", { exact: true }).fill("Acme Scheduler");
  await page.getByLabel("Redirect URI").fill(redirectUri);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const clientId = (await page.getByTestId("oauth-client-id").textContent()) ?? "";
  const clientSecret = (await page.getByTestId("oauth-client-secret").textContent()) ?? "";
  return { clientId, clientSecret };
}

test("third-party apps get a user's consent and call the API with the token", async ({
  browser,
  page,
  request,
}) => {
  const admin = await signUp(page);
  await makeAdmin(admin.email);
  const callback = await callbackServer();
  try {
    const { clientId, clientSecret } = await createClient(page, callback.url);
    const user = await (await newClientContext(browser)).newPage();
    const { email } = await signUp(user);

    const verifier = randomBytes(32).toString("base64url");
    const authorize = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callback.url,
      scope: "READ_PROFILE,READ_BOOKING",
      state: "xyz",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    });

    // Saying no sends the user back with access_denied.
    await user.goto(`/auth/oauth2/authorize?${authorize}`);
    await expect(user.getByText("Acme Scheduler wants to access your Cal.diy account")).toBeVisible();
    await user.getByRole("button", { name: "Go back" }).click();
    await expect(user).toHaveURL(/error=access_denied&state=xyz/);

    await user.goto(`/auth/oauth2/authorize?${authorize}`);
    await user.getByRole("button", { name: "Allow" }).click();
    await expect(user.getByRole("heading", { name: "Back at the app" })).toBeVisible();
    const redirected = new URL(user.url());
    expect(redirected.searchParams.get("state")).toBe("xyz");
    const code = redirected.searchParams.get("code") ?? "";

    const token = await request.post("/api/auth/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callback.url,
        code_verifier: verifier,
      },
    });
    expect(token.status()).toBe(200);
    const tokens = await token.json();
    expect(tokens).toMatchObject({ token_type: "bearer", expires_in: 1800 });
    // A code works once.
    const reused = await request.post("/api/auth/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callback.url,
        code_verifier: verifier,
      },
    });
    expect((await reused.json()).error).toBe("invalid_grant");

    const bearer = { authorization: `Bearer ${tokens.access_token}` };
    const me = await request.get("/api/v2/me", { headers: bearer });
    expect(me.status()).toBe(200);
    expect((await me.json()).data.email).toBe(email);
    // The scopes only grant reading.
    const write = await request.patch("/api/v2/me", { headers: bearer, data: { name: "Changed" } });
    expect(write.status()).toBe(403);

    const refreshed = await request.post("/api/auth/oauth/token", {
      form: {
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      },
    });
    const { access_token: next } = await refreshed.json();
    const again = await request.get("/api/auth/oauth/me", { headers: { authorization: `Bearer ${next}` } });
    expect(await again.json()).toEqual({ username: email.split("@")[0] });
  } finally {
    callback.close();
  }
});

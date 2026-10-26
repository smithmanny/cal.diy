import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { authClient } from "~/lib/auth-client";
import { AUTH_ERROR_MESSAGE_KEYS, authErrorKey, safeCallbackUrl } from "~/lib/auth-errors";
import { createT } from "~/lib/i18n";
import { getAuthProviders } from "~/server/auth/providers";
import { getSessionUser } from "~/server/auth/session";
import { getMessages } from "~/server/i18n";

const MESSAGE_KEYS = [
  "welcome_back",
  "sign_in_account",
  "email_address",
  "password",
  "sign_in",
  "or",
  "continue_with_google",
  "dont_have_an_account",
  "create_account",
  "loading",
  ...AUTH_ERROR_MESSAGE_KEYS,
];

function LoginPage() {
  const { messages, providers } = Route.useLoaderData();
  const { callbackUrl } = Route.useSearch();
  const navigate = useNavigate();
  const t = createT(messages);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setErrorKey(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) {
      setErrorKey(authErrorKey(error));
      return;
    }
    await navigate({ to: callbackUrl });
  }

  return (
    <main>
      <h1>{t("welcome_back")}</h1>
      <p>{t("sign_in_account")}</p>
      <form onSubmit={onSubmit}>
        <label>
          {t("email_address")}
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          {t("password")}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {errorKey && <p role="alert">{t(errorKey)}</p>}
        <button type="submit" disabled={pending}>
          {pending ? t("loading") : t("sign_in")}
        </button>
      </form>
      {providers.google && (
        <>
          <p>{t("or")}</p>
          <button
            type="button"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: callbackUrl })}>
            {t("continue_with_google")}
          </button>
        </>
      )}
      <p>
        {t("dont_have_an_account")} <Link to="/auth/signup">{t("create_account")}</Link>
      </p>
    </main>
  );
}

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>) => ({ callbackUrl: safeCallbackUrl(search.callbackUrl) }),
  beforeLoad: async ({ search }) => {
    if (await getSessionUser()) throw redirect({ href: search.callbackUrl });
  },
  loader: async () => {
    const [messages, providers] = await Promise.all([
      getMessages({ data: MESSAGE_KEYS }),
      getAuthProviders(),
    ]);
    return { messages, providers };
  },
  component: LoginPage,
});

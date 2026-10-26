import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { authClient } from "~/lib/auth-client";
import { AUTH_ERROR_MESSAGE_KEYS, authErrorKey } from "~/lib/auth-errors";
import { createT } from "~/lib/i18n";
import { getAuthProviders } from "~/server/auth/providers";
import { getSessionUser } from "~/server/auth/session";
import { getMessages } from "~/server/i18n";

const MESSAGE_KEYS = [
  "create_your_account",
  "username",
  "email_address",
  "password",
  "password_complexity_requirement",
  "create_account",
  "or",
  "signup_with_google",
  "already_have_account",
  "login_instead",
  "loading",
  ...AUTH_ERROR_MESSAGE_KEYS,
];

function SignupPage() {
  const { messages, providers } = Route.useLoaderData();
  const navigate = useNavigate();
  const t = createT(messages);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username"));
    setPending(true);
    setErrorKey(null);
    const { error } = await authClient.signUp.email({
      name: username,
      username,
      email: String(form.get("email")),
      password: String(form.get("password")),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setPending(false);
    if (error) {
      setErrorKey(authErrorKey(error));
      return;
    }
    await navigate({ to: "/event-types" });
  }

  return (
    <main>
      <h1>{t("create_your_account")}</h1>
      <form onSubmit={onSubmit}>
        <label>
          {t("username")}
          <input name="username" autoComplete="username" required />
        </label>
        <label>
          {t("email_address")}
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          {t("password")}
          <input name="password" type="password" autoComplete="new-password" minLength={7} required />
          <small>{t("password_complexity_requirement")}</small>
        </label>
        {errorKey && <p role="alert">{t(errorKey, { passwordLength: 7 })}</p>}
        <button type="submit" disabled={pending}>
          {pending ? t("loading") : t("create_account")}
        </button>
      </form>
      {providers.google && (
        <>
          <p>{t("or")}</p>
          <button
            type="button"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/event-types" })}>
            {t("signup_with_google")}
          </button>
        </>
      )}
      <p>
        {t("already_have_account")}{" "}
        <Link to="/auth/login" search={{ callbackUrl: "/event-types" }}>
          {t("login_instead")}
        </Link>
      </p>
    </main>
  );
}

export const Route = createFileRoute("/auth/signup")({
  beforeLoad: async () => {
    if (await getSessionUser()) throw redirect({ to: "/event-types" });
  },
  loader: async () => {
    const [messages, providers] = await Promise.all([
      getMessages({ data: MESSAGE_KEYS }),
      getAuthProviders(),
    ]);
    return { messages, providers };
  },
  component: SignupPage,
});

import { Button } from "@coss/ui/components/button";
import { createFileRoute, Link, redirect, useHydrated, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { AuthCard, FormError } from "~/components/AuthCard";
import { TextField } from "~/components/TextField";
import { authClient } from "~/lib/auth-client";
import { AUTH_ERROR_MESSAGE_KEYS, authErrorKey, safeCallbackUrl } from "~/lib/auth-errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { getAuthProviders } from "~/server/auth/providers";

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
  const { providers } = Route.useLoaderData();
  const { callbackUrl } = Route.useSearch();
  const navigate = useNavigate();
  const t = useT();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Until React hydrates, a click would fall back to a native form submit and post the
  // credentials to this page instead of the auth API, so the button stays disabled.
  const hydrated = useHydrated();

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
    await navigate({ href: callbackUrl });
  }

  return (
    <AuthCard
      title={t("welcome_back")}
      subtitle={t("sign_in_account")}
      footer={
        <>
          {t("dont_have_an_account")}{" "}
          <Link to="/auth/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            {t("create_account")}
          </Link>
        </>
      }>
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField label={t("email_address")} name="email" type="email" autoComplete="email" required />
        <TextField
          label={t("password")}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <FormError message={errorKey && t(errorKey)} />
        <Button type="submit" disabled={pending || !hydrated}>
          {pending ? t("loading") : t("sign_in")}
        </Button>
      </form>
      {providers.google && (
        <>
          <div className="my-4 text-center text-muted-foreground text-xs">{t("or")}</div>
          <Button
            variant="outline"
            className="w-full"
            disabled={!hydrated}
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: callbackUrl })}>
            {t("continue_with_google")}
          </Button>
        </>
      )}
    </AuthCard>
  );
}

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>) => ({ callbackUrl: safeCallbackUrl(search.callbackUrl) }),
  beforeLoad: ({ context, search }) => {
    if (context.user) throw redirect({ href: search.callbackUrl });
  },
  loader: async ({ context }) => {
    const [messages, providers] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getAuthProviders(),
    ]);
    return { messages, providers };
  },
  component: LoginPage,
});

import { Button } from "@coss/ui/components/button";
import { createFileRoute, Link, notFound, useHydrated } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { AuthCard, FormError } from "~/components/AuthCard";
import { TextField } from "~/components/TextField";
import { authClient } from "~/lib/auth-client";
import { AUTH_ERROR_MESSAGE_KEYS, AUTH_ERROR_VALUES, authErrorKey } from "~/lib/auth-errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { getAuthProviders } from "~/server/auth/providers";

const MESSAGE_KEYS = [
  "forgot_password",
  "email_address",
  "request_password_reset",
  "reset_link_sent",
  "password_reset_email",
  "password_reset_leading",
  "back_to_signin",
  "loading",
  ...AUTH_ERROR_MESSAGE_KEYS,
];

function ForgotPasswordPage() {
  const t = useT();
  const hydrated = useHydrated();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    setPending(true);
    setErrorKey(null);
    // The response is the same whether or not the account exists, so this can't be used to probe emails.
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/auth/reset-password" });
    setPending(false);
    if (error) {
      setErrorKey(authErrorKey(error));
      return;
    }
    setSentTo(email);
  }

  const backToSignIn = (
    <Link to="/auth/login" search={{ callbackUrl: "/event-types" }} className="font-medium text-foreground">
      {t("back_to_signin")}
    </Link>
  );

  if (sentTo) {
    return (
      <AuthCard title={t("reset_link_sent")} footer={backToSignIn}>
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("password_reset_email", { email: sentTo })}</p>
          <p className="text-muted-foreground">{t("password_reset_leading")}</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("forgot_password")} footer={backToSignIn}>
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField label={t("email_address")} name="email" type="email" autoComplete="email" required />
        <FormError message={errorKey && t(errorKey, AUTH_ERROR_VALUES)} />
        <Button type="submit" disabled={pending || !hydrated}>
          {pending ? t("loading") : t("request_password_reset")}
        </Button>
      </form>
    </AuthCard>
  );
}

export const Route = createFileRoute("/auth/forgot-password")({
  loader: async ({ context }) => {
    const [messages, providers] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getAuthProviders(),
    ]);
    if (!providers.email) throw notFound();
    return { messages };
  },
  component: ForgotPasswordPage,
});

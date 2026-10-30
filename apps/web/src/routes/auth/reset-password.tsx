import { Button } from "@coss/ui/components/button";
import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { AuthCard, FormError } from "~/components/AuthCard";
import { TextField } from "~/components/TextField";
import { authClient } from "~/lib/auth-client";
import { AUTH_ERROR_MESSAGE_KEYS, AUTH_ERROR_VALUES, authErrorKey } from "~/lib/auth-errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";

const MESSAGE_KEYS = [
  "reset_password",
  "new_password",
  "invalid_password_hint",
  "password_has_been_changed",
  "invalid_link",
  "forgot_password",
  "back_to_signin",
  "loading",
  ...AUTH_ERROR_MESSAGE_KEYS,
];

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  const t = useT();
  const hydrated = useHydrated();
  const [done, setDone] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const newPassword = String(new FormData(event.currentTarget).get("password"));
    setPending(true);
    setErrorKey(null);
    const result = await authClient.resetPassword({ newPassword, token });
    setPending(false);
    if (result.error) {
      setErrorKey(authErrorKey(result.error));
      return;
    }
    setDone(true);
  }

  const backToSignIn = (
    <Link to="/auth/login" search={{ callbackUrl: "/event-types" }} className="font-medium text-foreground">
      {t("back_to_signin")}
    </Link>
  );

  if (!token || error) {
    return (
      <AuthCard title={t("invalid_link")} footer={backToSignIn}>
        <Link to="/auth/forgot-password" className="text-sm underline underline-offset-4">
          {t("forgot_password")}
        </Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title={t("reset_password")} footer={backToSignIn}>
        <p role="status" className="text-sm">
          {t("password_has_been_changed")}
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("reset_password")} footer={backToSignIn}>
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label={t("new_password")}
          name="password"
          type="password"
          autoComplete="new-password"
          hint={t("invalid_password_hint", AUTH_ERROR_VALUES)}
          required
        />
        <FormError message={errorKey && t(errorKey, AUTH_ERROR_VALUES)} />
        <Button type="submit" disabled={pending || !hydrated}>
          {pending ? t("loading") : t("reset_password")}
        </Button>
      </form>
    </AuthCard>
  );
}

export const Route = createFileRoute("/auth/reset-password")({
  validateSearch: (search: Record<string, unknown>): { token?: string; error?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  loader: async ({ context }) => ({ messages: await loadMessages(context, MESSAGE_KEYS) }),
  component: ResetPasswordPage,
});

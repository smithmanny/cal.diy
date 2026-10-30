import { Button } from "@coss/ui/components/button";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { selectClass } from "~/components/availability/TimeSelect";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { TextField } from "~/components/TextField";
import { TimeZoneSelect } from "~/components/TimeZoneSelect";
import { requireAdmin } from "~/lib/admin-guard";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { SUPPORTED_LOCALES } from "~/lib/locales";
import { loadMessages } from "~/lib/messages";
import { getAdminUser, updateAdminUser } from "~/server/admin/functions";

const MESSAGE_KEYS = [
  "edit_user",
  "full_name",
  "email",
  "username",
  "role",
  "user",
  "admin",
  "timezone",
  "language",
  "update",
  "go_back",
  "settings_updated_successfully",
  "username_already_taken",
  "email_already_used",
  "invalid_timezone",
  "cannot_change_own_role",
  "admin_needs_two_factor",
  "something_went_wrong",
];

function displayName(locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}

function EditUserPage() {
  const { user } = Route.useLoaderData();
  const t = useT();
  const router = useRouter();
  const [timeZone, setTimeZone] = useState(user.timeZone);
  const [status, setStatus] = useState<{ key: string; error: boolean } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus(null);
    try {
      await updateAdminUser({
        data: {
          id: user.id,
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          username: String(form.get("username") ?? ""),
          role: form.get("role") === "ADMIN" ? "ADMIN" : "USER",
          timeZone,
          locale: String(form.get("locale") ?? "en"),
        },
      });
      setStatus({ key: "settings_updated_successfully", error: false });
      await router.invalidate();
    } catch (error) {
      setStatus({ key: errorMessageKey(error), error: true });
    }
  }

  return (
    <HydratedFieldset>
      <h2 className="mb-4 font-heading text-lg">{t("edit_user")}</h2>
      <form onSubmit={submit} className="flex max-w-lg flex-col gap-4">
        <TextField label={t("full_name")} name="name" defaultValue={user.name ?? ""} />
        <TextField label={t("email")} name="email" type="email" required defaultValue={user.email} />
        <TextField label={t("username")} name="username" required defaultValue={user.username ?? ""} />
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("role")}
          <select name="role" className={selectClass} defaultValue={user.role}>
            <option value="USER">{t("user")}</option>
            <option value="ADMIN">{t("admin")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("timezone")}
          <TimeZoneSelect value={timeZone} onChange={setTimeZone} />
        </label>
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("language")}
          <select name="locale" className={selectClass} defaultValue={user.locale ?? "en"}>
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {displayName(locale)}
              </option>
            ))}
          </select>
        </label>
        {status?.error && <FormError message={t(status.key)} />}
        {status && !status.error && (
          <p role="status" className="text-sm text-success-foreground">
            {t(status.key)}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit">{t("update")}</Button>
          <Button variant="ghost" render={<Link to="/settings/admin/users" />}>
            {t("go_back")}
          </Button>
        </div>
      </form>
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/admin/users/$userId")({
  params: {
    parse: ({ userId }) => {
      const id = Number(userId);
      if (!Number.isInteger(id) || id <= 0) throw notFound();
      return { userId: id };
    },
    stringify: ({ userId }) => ({ userId: String(userId) }),
  },
  beforeLoad: ({ context }) => requireAdmin(context),
  loader: async ({ context, params }) => {
    const [messages, user] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getAdminUser({ data: { id: params.userId } }),
    ]);
    return { messages, user };
  },
  component: EditUserPage,
});

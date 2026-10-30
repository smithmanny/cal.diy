import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { selectClass } from "~/components/availability/TimeSelect";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { TimeZoneSelect } from "~/components/TimeZoneSelect";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { SUPPORTED_LOCALES } from "~/lib/locales";
import { loadMessages } from "~/lib/messages";
import { getProfile, updateProfile } from "~/server/profile/functions";

const MESSAGE_KEYS = [
  "full_name",
  "email",
  "username",
  "timezone",
  "language",
  "save",
  "profile_updated_successfully",
  "invalid_timezone",
  "something_went_wrong",
];

function languageName(locale: string, displayLocale: string): string {
  try {
    return new Intl.DisplayNames([displayLocale], { type: "language" }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}

function ProfilePage() {
  const { profile } = Route.useLoaderData();
  const { locale: currentLocale } = Route.useRouteContext();
  const t = useT();
  const router = useRouter();
  const [timeZone, setTimeZone] = useState(profile.timeZone);
  const [status, setStatus] = useState<{ kind: "error" | "saved"; key: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus(null);
    try {
      await updateProfile({
        data: { name: String(form.get("name")), timeZone, locale: String(form.get("locale")) },
      });
      // Re-runs the root context so a new language applies right away.
      await router.invalidate();
      setStatus({ kind: "saved", key: "profile_updated_successfully" });
    } catch (error) {
      setStatus({ kind: "error", key: errorMessageKey(error) });
    }
  }

  return (
    <HydratedFieldset>
      <form method="post" onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("full_name")}
          <Input name="name" required maxLength={200} defaultValue={profile.name ?? ""} />
        </label>
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("username")}</span>
          <span className="text-muted-foreground">{profile.username}</span>
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("email")}</span>
          <span className="text-muted-foreground">{profile.email}</span>
        </div>
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("timezone")}
          <TimeZoneSelect value={timeZone} onChange={setTimeZone} />
        </label>
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("language")}
          <select name="locale" className={selectClass} defaultValue={profile.locale ?? currentLocale}>
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {languageName(locale, locale)}
              </option>
            ))}
          </select>
        </label>
        {status &&
          (status.kind === "error" ? (
            <FormError message={t(status.key)} />
          ) : (
            <p role="status" className="text-sm text-success-foreground">
              {t(status.key)}
            </p>
          ))}
        <Button type="submit" className="self-start">
          {t("save")}
        </Button>
      </form>
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/my-account/profile")({
  loader: async ({ context }) => {
    const [messages, profile] = await Promise.all([loadMessages(context, MESSAGE_KEYS), getProfile()]);
    return { messages, profile };
  },
  component: ProfilePage,
});

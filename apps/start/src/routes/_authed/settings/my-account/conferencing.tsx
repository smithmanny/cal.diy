import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { AppLogo } from "~/components/AppLogo";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { errorMessageKey } from "~/lib/errors";
import type { TFunction } from "~/lib/i18n";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import type { ConferencingAppDto } from "~/server/apps/AppsService";
import { getConferencingSettings, setDefaultConferencingApp, uninstallApp } from "~/server/apps/functions";

const MESSAGE_KEYS = [
  "conferencing",
  "conferencing_description",
  "default_conferencing_app_description",
  "no_conferencing_apps",
  "browse_apps",
  "default",
  "set_as_default",
  "remove_app",
  "your_room_link",
  "save",
  "cancel",
  "invalid_link",
  "url_validation_error",
  "something_went_wrong",
  "not_found",
];

type Run = (action: () => Promise<unknown>) => Promise<boolean>;

/** Static-link apps need the host's room link before they can be the default. */
function RoomLinkForm({
  app,
  run,
  onDone,
  t,
}: {
  app: ConferencingAppDto;
  run: Run;
  onDone: () => void;
  t: TFunction;
}) {
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const link = String(new FormData(event.currentTarget).get("link"));
    if (await run(() => setDefaultConferencingApp({ data: { slug: app.slug, link } }))) onDone();
  }
  return (
    <form method="post" onSubmit={onSubmit} className="flex w-full flex-wrap items-center gap-2">
      <Input
        name="link"
        type="url"
        required
        placeholder="https://"
        aria-label={t("your_room_link")}
        className="flex-1"
      />
      <Button type="button" variant="outline" size="sm" onClick={onDone}>
        {t("cancel")}
      </Button>
      <Button type="submit" size="sm">
        {t("save")}
      </Button>
    </form>
  );
}

function ConferencingApp({
  app,
  isDefault,
  run,
  t,
}: {
  app: ConferencingAppDto;
  isDefault: boolean;
  run: Run;
  t: TFunction;
}) {
  const [askingLink, setAskingLink] = useState(false);
  const { credentialId } = app;
  const makeDefault = () =>
    app.linkPattern
      ? setAskingLink(true)
      : run(() => setDefaultConferencingApp({ data: { slug: app.slug, link: null } }));
  return (
    <li className="flex flex-wrap items-center gap-3 p-4" aria-label={app.name}>
      <AppLogo src={app.logoUrl} />
      <span className="flex-1 font-medium">{app.name}</span>
      {isDefault ? (
        <span className="rounded bg-muted px-2 py-0.5 text-xs">{t("default")}</span>
      ) : (
        <Button variant="outline" size="sm" onClick={makeDefault}>
          {t("set_as_default")}
        </Button>
      )}
      {credentialId !== null && (
        <Button
          variant="outline"
          size="sm"
          aria-label={`${t("remove_app")}: ${app.name}`}
          onClick={() => run(() => uninstallApp({ data: { credentialId } }))}>
          {t("remove_app")}
        </Button>
      )}
      {askingLink && <RoomLinkForm app={app} run={run} onDone={() => setAskingLink(false)} t={t} />}
    </li>
  );
}

function ConferencingPage() {
  const { settings } = Route.useLoaderData();
  const t = useT();
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const run: Run = async (action) => {
    setErrorKey(null);
    try {
      await action();
      await router.invalidate();
      return true;
    } catch (failure) {
      setErrorKey(errorMessageKey(failure));
      return false;
    }
  };

  return (
    <HydratedFieldset className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg">{t("conferencing")}</h2>
          <p className="text-muted-foreground text-sm">{t("default_conferencing_app_description")}</p>
        </div>
        <Button variant="outline" render={<Link to="/apps" />}>
          {t("browse_apps")}
        </Button>
      </div>
      <FormError message={errorKey && t(errorKey)} />
      {settings.apps.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          {t("no_conferencing_apps")}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {settings.apps.map((app) => (
            <ConferencingApp
              key={app.slug}
              app={app}
              isDefault={settings.defaultApp?.appSlug === app.slug}
              run={run}
              t={t}
            />
          ))}
        </ul>
      )}
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/my-account/conferencing")({
  loader: async ({ context }) => {
    const [messages, settings] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getConferencingSettings(),
    ]);
    return { messages, settings };
  },
  component: ConferencingPage,
});

import { Button } from "@coss/ui/components/button";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { AppLogo } from "~/components/AppLogo";
import { PageHeader } from "~/components/AppShell";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { TextField } from "~/components/TextField";
import { errorMessageKey } from "~/lib/errors";
import type { TFunction } from "~/lib/i18n";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import type { AppDto } from "~/server/apps/AppsService";
import { connectCalDavApp, getApps, installApp, uninstallApp } from "~/server/apps/functions";

const MESSAGE_KEYS = [
  "apps",
  "conferencing_description",
  "calendars",
  "conferencing",
  "payments",
  "install",
  "installed",
  "remove_app",
  "app_not_configured",
  "connect",
  "cancel",
  "calendar_url",
  "username",
  "password",
  "app_specific_password",
  "apple_server_generate_password",
  "calendar_connection_fail",
  "invalid_url",
  "something_went_wrong",
  "not_found",
];

const CATEGORIES = [
  { category: "calendar", labelKey: "calendars" },
  { category: "conferencing", labelKey: "conferencing" },
  { category: "payment", labelKey: "payments" },
] as const;

type Run = (action: () => Promise<unknown>) => Promise<boolean>;

function CalDavForm({ app, run, onDone, t }: { app: AppDto; run: Run; onDone: () => void; t: TFunction }) {
  const isApple = app.slug === "apple-calendar";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const connected = await run(() =>
      connectCalDavApp({
        data: {
          slug: app.slug,
          url: isApple ? undefined : String(form.get("url")),
          username: String(form.get("username")),
          password: String(form.get("password")),
        },
      })
    );
    if (connected) onDone();
  }

  return (
    <form method="post" onSubmit={onSubmit} className="flex w-full flex-col gap-3 border-t pt-3">
      {!isApple && (
        <TextField label={t("calendar_url")} name="url" type="url" required placeholder="https://" />
      )}
      <TextField label={t("username")} name="username" required autoComplete="off" />
      <TextField
        label={isApple ? t("app_specific_password") : t("password")}
        name="password"
        type="password"
        required
        autoComplete="new-password"
        hint={
          isApple
            ? `${t("apple_server_generate_password", { appName: app.name })} appleid.apple.com`
            : undefined
        }
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit">{t("connect")}</Button>
      </div>
    </form>
  );
}

function AppActions({ app, run, onSetup, t }: { app: AppDto; run: Run; onSetup: () => void; t: TFunction }) {
  if (!app.available) return <span className="text-muted-foreground text-xs">{t("app_not_configured")}</span>;
  if (app.install === "global")
    return <span className="text-muted-foreground text-xs">{t("installed")}</span>;
  const installed = app.credentialIds.length > 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {installed &&
        app.credentialIds.map((credentialId) => (
          <Button
            key={credentialId}
            variant="outline"
            size="sm"
            aria-label={`${t("remove_app")}: ${app.name}`}
            onClick={() => run(() => uninstallApp({ data: { credentialId } }))}>
            {t("remove_app")}
          </Button>
        ))}
      {app.install === "oauth" && !installed && <InstallLink app={app} t={t} />}
      {app.install === "simple" && !installed && (
        <Button size="sm" onClick={() => run(() => installApp({ data: { slug: app.slug } }))}>
          {t("install")}
        </Button>
      )}
      {app.install === "credentials" && (
        <Button size="sm" variant={installed ? "outline" : "default"} onClick={onSetup}>
          {t("connect")}
        </Button>
      )}
    </div>
  );
}

function InstallLink({ app, t }: { app: AppDto; t: TFunction }) {
  // A full page navigation: the OAuth flow leaves the app for the provider and comes back.
  return (
    <Button size="sm" render={<a href={`/api/integrations/${app.dirName}/add`} />}>
      {t("install")}
    </Button>
  );
}

function AppCard({
  app,
  run,
  setupOpen,
  onSetup,
  t,
}: {
  app: AppDto;
  run: Run;
  setupOpen: boolean;
  onSetup: (open: boolean) => void;
  t: TFunction;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border p-4" aria-label={app.name}>
      <AppLogo src={app.logoUrl} />
      <span className="flex-1 font-medium">{app.name}</span>
      {app.credentialIds.length > 0 && app.install !== "credentials" && (
        <span className="rounded bg-muted px-2 py-0.5 text-xs">{t("installed")}</span>
      )}
      <AppActions app={app} run={run} onSetup={() => onSetup(true)} t={t} />
      {setupOpen && <CalDavForm app={app} run={run} onDone={() => onSetup(false)} t={t} />}
    </li>
  );
}

function AppsPage() {
  const { apps } = Route.useLoaderData();
  const { setup } = Route.useSearch();
  const t = useT();
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [openSetup, setOpenSetup] = useState<string | null>(setup ?? null);

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
    <HydratedFieldset>
      <PageHeader title={t("apps")} description={t("conferencing_description")} />
      <FormError message={errorKey && t(errorKey)} />
      {CATEGORIES.map(({ category, labelKey }) => (
        <section key={category} className="mb-8 flex flex-col gap-3">
          <h2 className="font-heading text-lg">{t(labelKey)}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {apps
              .filter((app) => app.category === category)
              .map((app) => (
                <AppCard
                  key={app.slug}
                  app={app}
                  run={run}
                  setupOpen={openSetup === app.slug}
                  onSetup={(open) => setOpenSetup(open ? app.slug : null)}
                  t={t}
                />
              ))}
          </ul>
        </section>
      ))}
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/apps/")({
  validateSearch: (search: Record<string, unknown>): { setup?: string } => ({
    setup: typeof search.setup === "string" && /^[a-z0-9-]+$/.test(search.setup) ? search.setup : undefined,
  }),
  loader: async ({ context }) => {
    const [messages, apps] = await Promise.all([loadMessages(context, MESSAGE_KEYS), getApps()]);
    return { messages, apps };
  },
  component: AppsPage,
});

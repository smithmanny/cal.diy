import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { PageHeader } from "~/components/AppShell";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";

const TABS = [
  { to: "/settings/my-account/profile", labelKey: "profile" },
  { to: "/settings/my-account/general", labelKey: "general" },
  { to: "/settings/my-account/appearance", labelKey: "appearance" },
  { to: "/settings/my-account/calendars", labelKey: "calendars" },
  { to: "/settings/my-account/out-of-office", labelKey: "out_of_office" },
  { to: "/settings/security/password", labelKey: "password" },
  { to: "/settings/security/two-factor-auth", labelKey: "two_factor_auth" },
  { to: "/settings/developer/webhooks", labelKey: "webhooks" },
  { to: "/settings/developer/api-keys", labelKey: "api_keys" },
] as const;

function SettingsLayout() {
  const t = useT();
  return (
    <>
      <PageHeader title={t("settings")} />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="-mb-px whitespace-nowrap border-b-2 px-3 py-2 font-medium text-sm"
            activeProps={{ className: "border-foreground text-foreground" }}
            inactiveProps={{ className: "border-transparent text-muted-foreground" }}>
            {t(tab.labelKey)}
          </Link>
        ))}
      </nav>
      <Outlet />
    </>
  );
}

export const Route = createFileRoute("/_authed/settings")({
  loader: async ({ context }) => ({
    messages: await loadMessages(context, ["settings", ...TABS.map((tab) => tab.labelKey)]),
  }),
  component: SettingsLayout,
});

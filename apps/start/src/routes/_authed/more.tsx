import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { PageHeader } from "~/components/AppShell";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { authClient } from "~/lib/auth-client";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";

const LINKS = [
  { to: "/settings/my-account/profile", labelKey: "profile" },
  { to: "/settings/my-account/general", labelKey: "general" },
  { to: "/settings/my-account/out-of-office", labelKey: "out_of_office" },
  { to: "/settings/my-account/push-notifications", labelKey: "push_notifications" },
  { to: "/settings/developer/api-keys", labelKey: "api_keys" },
] as const;

const rowClass = "flex items-center justify-between px-4 py-3 text-sm hover:bg-accent/50";

/** Cal's mobile "More" page: settings shortcuts and signing out. */
function MorePage() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <HydratedFieldset>
      <PageHeader title={t("more")} />
      <ul className="divide-y overflow-hidden rounded-xl border">
        {LINKS.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className={rowClass}>
              {t(link.labelKey)}
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={`${rowClass} w-full text-left`}
            onClick={async () => {
              await authClient.signOut();
              await navigate({ to: "/auth/login", search: { callbackUrl: "/event-types" } });
            }}>
            {t("sign_out")}
          </button>
        </li>
      </ul>
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/more")({
  loader: async ({ context }) => ({
    messages: await loadMessages(context, ["more", "sign_out", ...LINKS.map((link) => link.labelKey)]),
  }),
  component: MorePage,
});

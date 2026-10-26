import { Button } from "@coss/ui/components/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDaysIcon, ClockIcon, LinkIcon, LogOutIcon, SettingsIcon, WebhookIcon } from "lucide-react";
import { type ComponentType, type ReactNode, useState } from "react";
import { authClient } from "~/lib/auth-client";
import { useT } from "~/lib/i18n";
import type { SessionUser } from "~/server/auth/session";
import { HydratedFieldset } from "./HydratedFieldset";

type NavItem = { to: string; labelKey: string; icon: ComponentType<{ className?: string }> };

const NAV_ITEMS: NavItem[] = [
  { to: "/event-types", labelKey: "event_types_page_title", icon: LinkIcon },
  { to: "/bookings/upcoming", labelKey: "bookings", icon: CalendarDaysIcon },
  { to: "/availability", labelKey: "availability", icon: ClockIcon },
  { to: "/settings/developer/webhooks", labelKey: "webhooks", icon: WebhookIcon },
  { to: "/settings/my-account/profile", labelKey: "settings", icon: SettingsIcon },
];

const navLinkClass =
  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground";

function VerifyEmailBanner({ email }: { email: string }) {
  const t = useT();
  const [sent, setSent] = useState(false);
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/32 bg-warning/8 px-4 py-3 text-sm">
      <span>{t("verify_email_banner_body")}</span>
      {sent ? (
        <span className="text-muted-foreground">{t("verification_email_sent")}</span>
      ) : (
        <HydratedFieldset>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const { error } = await authClient.sendVerificationEmail({
                email,
                callbackURL: "/event-types",
              });
              if (!error) setSent(true);
            }}>
            {t("resend_email")}
          </Button>
        </HydratedFieldset>
      )}
    </div>
  );
}

export const APP_SHELL_MESSAGE_KEYS = [
  "event_types_page_title",
  "bookings",
  "availability",
  "webhooks",
  "settings",
  "sign_out",
  "verify_email_banner_body",
  "resend_email",
  "verification_email_sent",
];

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const t = useT();
  const navigate = useNavigate();

  async function signOut() {
    await authClient.signOut();
    await navigate({ to: "/auth/login", search: { callbackUrl: "/event-types" } });
  }

  const nav = (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className={navLinkClass}
          activeProps={{ className: "bg-accent text-foreground" }}
          inactiveProps={{ className: "text-muted-foreground" }}
          activeOptions={{ includeSearch: false }}>
          <Icon className="size-4 shrink-0" />
          <span className="whitespace-nowrap">{t(labelKey)}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b bg-sidebar p-3 md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center justify-between">
          <Link to="/event-types" className="px-2 font-heading text-xl">
            Cal.diy
          </Link>
          <HydratedFieldset>
            <button
              type="button"
              onClick={signOut}
              aria-label={t("sign_out")}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden">
              <LogOutIcon className="size-4" />
            </button>
          </HydratedFieldset>
        </div>
        {nav}
        <div className="mt-auto hidden flex-col gap-1 md:flex">
          <div className="truncate px-2 text-sm">
            <div className="truncate font-medium">{user.name ?? user.username}</div>
            <div className="truncate text-muted-foreground text-xs">{user.email}</div>
          </div>
          <HydratedFieldset>
            <button type="button" onClick={signOut} className={`${navLinkClass} text-muted-foreground`}>
              <LogOutIcon className="size-4" />
              {t("sign_out")}
            </button>
          </HydratedFieldset>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-8">
        {user.needsEmailVerification && <VerifyEmailBanner email={user.email} />}
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

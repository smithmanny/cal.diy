import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "~/components/AuthCard";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";

/** Cal's maintenance page, for a proxy to send visitors to during upgrades. */
function MaintenancePage() {
  const t = useT();
  return (
    <AuthCard title={t("under_maintenance")}>
      <p className="text-muted-foreground text-sm">
        {t("under_maintenance_description", { appName: "Cal.diy" })}
      </p>
    </AuthCard>
  );
}

export const Route = createFileRoute("/maintenance")({
  loader: async ({ context }) => ({
    messages: await loadMessages(context, ["under_maintenance", "under_maintenance_description"]),
  }),
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: MaintenancePage,
});

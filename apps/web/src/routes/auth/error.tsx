import { Button } from "@coss/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthCard } from "~/components/AuthCard";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";

/** Where a failed sign-in (say, a cancelled Google consent) ends up, as in Cal. */
function AuthErrorPage() {
  const t = useT();
  return (
    <AuthCard title={t("something_went_wrong")} subtitle={t("error_during_login")}>
      <Button className="w-full" render={<Link to="/auth/login" search={{ callbackUrl: "/event-types" }} />}>
        {t("go_back_login")}
      </Button>
    </AuthCard>
  );
}

export const Route = createFileRoute("/auth/error")({
  loader: async ({ context }) => ({
    messages: await loadMessages(context, ["something_went_wrong", "error_during_login", "go_back_login"]),
  }),
  component: AuthErrorPage,
});

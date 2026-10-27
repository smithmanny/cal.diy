import { Button } from "@coss/ui/components/button";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthCard } from "~/components/AuthCard";
import { authClient } from "~/lib/auth-client";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";

/** Cal's /auth/logout: ends the session wherever the link came from, then says so. */
function LogoutPage() {
  const t = useT();
  const router = useRouter();
  const [done, setDone] = useState(false);
  useEffect(() => {
    authClient
      .signOut()
      .then(() => router.invalidate())
      .finally(() => setDone(true));
  }, [router]);
  // Only claim the user is out once the session is really gone.
  if (!done) return <AuthCard title="Cal.diy">{null}</AuthCard>;
  return (
    <AuthCard title={t("youve_been_logged_out")} subtitle={t("hope_to_see_you_soon")}>
      <Button className="w-full" render={<Link to="/auth/login" search={{ callbackUrl: "/event-types" }} />}>
        {t("go_back_login")}
      </Button>
    </AuthCard>
  );
}

export const Route = createFileRoute("/auth/logout")({
  loader: async ({ context }) => ({
    messages: await loadMessages(context, ["youve_been_logged_out", "hope_to_see_you_soon", "go_back_login"]),
  }),
  component: LogoutPage,
});

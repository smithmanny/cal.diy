import { Button } from "@coss/ui/components/button";
import { createFileRoute, redirect, useHydrated } from "@tanstack/react-router";
import { useState } from "react";
import { AuthCard, FormError } from "~/components/AuthCard";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { approveOAuthAuthorization, getOAuthAuthorizeClient } from "~/server/oauth/functions";

const MESSAGE_KEYS = [
  "access_cal_account",
  "allow_client_to",
  "associate_with_cal_account",
  "see_personal_info",
  "see_primary_email_address",
  "access_bookings",
  "allow_client_to_do",
  "oauth_access_information",
  "signed_in_as",
  "allow",
  "go_back",
  "authorizing",
  "unauthorized_client",
  "invalid_request",
  "something_went_wrong",
];

type AuthorizeSearch = {
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
};

const text = (value: unknown) => (value === undefined || value === null ? undefined : String(value));

function Permissions({ clientName, scope }: { clientName: string; scope: string | undefined }) {
  const t = useT();
  const items = [
    t("associate_with_cal_account", { clientName }),
    t("see_personal_info"),
    t("see_primary_email_address"),
    ...(scope?.includes("READ_BOOKING") ? [t("access_bookings")] : []),
  ];
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {items.map((item) => (
        <li key={item} className="relative pl-5">
          <span className="absolute left-0" aria-hidden>
            ✓
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function AuthorizePage() {
  const { client } = Route.useLoaderData();
  const search = Route.useSearch();
  const { user } = Route.useRouteContext();
  const t = useT();
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function allow() {
    setPending(true);
    setErrorKey(null);
    try {
      const url = await approveOAuthAuthorization({
        data: {
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          scope: search.scope,
          state: search.state,
          codeChallenge: search.code_challenge,
          codeChallengeMethod: search.code_challenge_method,
        },
      });
      window.location.assign(url);
    } catch (error) {
      setPending(false);
      setErrorKey(errorMessageKey(error));
    }
  }

  function deny() {
    const url = new URL(client.redirectUri);
    url.searchParams.set("error", "access_denied");
    if (search.state) url.searchParams.set("state", search.state);
    window.location.assign(url.toString());
  }

  return (
    <AuthCard title={t("access_cal_account", { clientName: client.name, appName: "Cal.diy" })}>
      <div className="flex flex-col gap-4">
        {client.logo && <img src={client.logo} alt="" className="size-12 rounded-md" />}
        <p className="text-muted-foreground text-sm">{t("signed_in_as", { name: user?.email ?? "" })}</p>
        <p className="font-semibold text-sm">{t("allow_client_to", { clientName: client.name })}</p>
        <Permissions clientName={client.name} scope={search.scope} />
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="mb-1 font-medium">{t("allow_client_to_do", { clientName: client.name })}</p>
          <p>{t("oauth_access_information", { appName: "Cal.diy" })}</p>
        </div>
        <FormError message={errorKey && t(errorKey)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={deny} disabled={!hydrated}>
            {t("go_back")}
          </Button>
          <Button onClick={allow} disabled={pending || !hydrated}>
            {pending ? t("authorizing") : t("allow")}
          </Button>
        </div>
      </div>
    </AuthCard>
  );
}

export const Route = createFileRoute("/auth/oauth2/authorize")({
  validateSearch: (search: Record<string, unknown>): AuthorizeSearch => ({
    client_id: text(search.client_id) ?? "",
    redirect_uri: text(search.redirect_uri) ?? "",
    scope: text(search.scope),
    state: text(search.state),
    code_challenge: text(search.code_challenge),
    code_challenge_method: text(search.code_challenge_method),
  }),
  beforeLoad: ({ context, location }) => {
    if (!context.user) throw redirect({ to: "/auth/login", search: { callbackUrl: location.href } });
  },
  loaderDeps: ({ search }) => ({ clientId: search.client_id, redirectUri: search.redirect_uri }),
  loader: async ({ context, deps }) => {
    // An unknown client or a redirect URI it didn't register gets an error page, never a redirect.
    const [messages, client] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getOAuthAuthorizeClient({ data: deps }),
    ]);
    return { messages, client };
  },
  component: AuthorizePage,
});

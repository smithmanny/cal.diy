import { Button } from "@coss/ui/components/button";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { selectClass } from "~/components/availability/TimeSelect";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { TextField } from "~/components/TextField";
import { requireAdmin } from "~/lib/admin-guard";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { createOAuthClient, deleteOAuthClient, listOAuthClients } from "~/server/oauth/functions";

const MESSAGE_KEYS = [
  "oauth_clients",
  "oauth_clients_description",
  "create_oauth_client",
  "no_oauth_clients",
  "client_name",
  "client_id",
  "client_secret",
  "redirect_uri",
  "logo",
  "client_type",
  "confidential",
  "public",
  "create",
  "delete",
  "done",
  "delete_oauth_client",
  "confirm_delete_oauth_client",
  "oauth_client_created",
  "oauth_client_client_secret_one_time_warning",
  "something_went_wrong",
];

type Created = { clientId: string; clientSecret: string | null };

function CreatedClient({ created, onDone }: { created: Created; onDone: () => void }) {
  const t = useT();
  return (
    <div role="status" className="mb-6 flex flex-col gap-3 rounded-lg border p-4 text-sm">
      <p className="font-medium">{t("oauth_client_created")}</p>
      <div>
        <div className="text-muted-foreground">{t("client_id")}</div>
        <code data-testid="oauth-client-id" className="break-all font-mono">
          {created.clientId}
        </code>
      </div>
      {created.clientSecret && (
        <div>
          <div className="text-muted-foreground">{t("client_secret")}</div>
          <code data-testid="oauth-client-secret" className="break-all font-mono">
            {created.clientSecret}
          </code>
          <p className="mt-1 text-muted-foreground text-xs">
            {t("oauth_client_client_secret_one_time_warning")}
          </p>
        </div>
      )}
      <Button className="self-end" onClick={onDone}>
        {t("done")}
      </Button>
    </div>
  );
}

function NewClientForm({ onCreated }: { onCreated: (created: Created) => void }) {
  const t = useT();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setErrorKey(null);
    try {
      const logo = String(form.get("logo") ?? "").trim();
      onCreated(
        await createOAuthClient({
          data: {
            name: String(form.get("name") ?? ""),
            redirectUri: String(form.get("redirectUri") ?? ""),
            logo: logo || null,
            clientType: form.get("clientType") === "PUBLIC" ? "PUBLIC" : "CONFIDENTIAL",
          },
        })
      );
      element.reset();
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }
  return (
    <form onSubmit={submit} className="mb-8 flex max-w-lg flex-col gap-4">
      <h2 className="font-heading text-lg">{t("create_oauth_client")}</h2>
      <TextField label={t("client_name")} name="name" required />
      <TextField label={t("redirect_uri")} name="redirectUri" type="url" required />
      <TextField label={t("logo")} name="logo" type="url" />
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("client_type")}
        <select name="clientType" className={selectClass} defaultValue="CONFIDENTIAL">
          <option value="CONFIDENTIAL">{t("confidential")}</option>
          <option value="PUBLIC">{t("public")}</option>
        </select>
      </label>
      <FormError message={errorKey && t(errorKey)} />
      <Button type="submit" className="self-start">
        {t("create")}
      </Button>
    </form>
  );
}

function OAuthClientsPage() {
  const { clients } = Route.useLoaderData();
  const t = useT();
  const router = useRouter();
  const [created, setCreated] = useState<Created | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function remove(clientId: string) {
    if (!window.confirm(t("confirm_delete_oauth_client"))) return;
    try {
      await deleteOAuthClient({ data: { clientId } });
      await router.invalidate();
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }

  return (
    <HydratedFieldset>
      <p className="mb-6 text-muted-foreground text-sm">{t("oauth_clients_description")}</p>
      {created && <CreatedClient created={created} onDone={() => setCreated(null)} />}
      <NewClientForm
        onCreated={async (next) => {
          setCreated(next);
          await router.invalidate();
        }}
      />
      <FormError message={errorKey && t(errorKey)} />
      {clients.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          {t("no_oauth_clients")}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {clients.map((client) => (
            <li key={client.clientId} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{client.name}</div>
                <div className="truncate text-muted-foreground">{client.redirectUri}</div>
                <code className="truncate text-muted-foreground text-xs">{client.clientId}</code>
              </div>
              <Button size="sm" variant="destructive-outline" onClick={() => remove(client.clientId)}>
                {t("delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/admin/oauth")({
  beforeLoad: ({ context }) => requireAdmin(context),
  loader: async ({ context }) => {
    const [messages, clients] = await Promise.all([loadMessages(context, MESSAGE_KEYS), listOAuthClients()]);
    return { messages, clients };
  },
  component: OAuthClientsPage,
});

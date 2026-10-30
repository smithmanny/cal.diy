import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { KeyRoundIcon, TrashIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { selectClass } from "~/components/availability/TimeSelect";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { createApiKey, deleteApiKey, listApiKeys } from "~/server/api-keys/functions";

const MESSAGE_KEYS = [
  "api_keys",
  "api_key_modal_subtitle",
  "create_first_api_key",
  "create_first_api_key_description",
  "create_api_key",
  "personal_note",
  "personal_note_placeholder",
  "expire_date",
  "never_expires",
  "seven_days",
  "thirty_days",
  "three_months",
  "one_year",
  "expires",
  "expired",
  "api_key_never_expires",
  "create",
  "cancel",
  "delete",
  "copy",
  "api_key_copied",
  "done",
  "success_api_key_created",
  "success_api_key_created_bold_tagline",
  "you_will_only_view_it_once",
  "api_key_deleted",
  "something_went_wrong",
];

const EXPIRY_OPTIONS = [
  { days: null, labelKey: "never_expires" },
  { days: 7, labelKey: "seven_days" },
  { days: 30, labelKey: "thirty_days" },
  { days: 90, labelKey: "three_months" },
  { days: 365, labelKey: "one_year" },
] as const;

type ExpiryDays = (typeof EXPIRY_OPTIONS)[number]["days"];

function CreatedKey({ apiKey, onDone }: { apiKey: string; onDone: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4" role="status">
      <p className="font-medium">{t("success_api_key_created")}</p>
      <p className="text-sm">
        <strong>{t("success_api_key_created_bold_tagline")}</strong> {t("you_will_only_view_it_once")}
      </p>
      <code className="break-all rounded bg-muted px-3 py-2 font-mono text-sm" data-testid="new-api-key">
        {apiKey}
      </code>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(apiKey);
            setCopied(true);
          }}>
          {copied ? t("api_key_copied") : t("copy")}
        </Button>
        <Button onClick={onDone}>{t("done")}</Button>
      </div>
    </div>
  );
}

function ApiKeysPage() {
  const { keys } = Route.useLoaderData();
  const { locale } = Route.useRouteContext();
  const t = useT();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<ExpiryDays>(30);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorKey(null);
    try {
      const { key } = await createApiKey({
        data: { name: String(new FormData(event.currentTarget).get("name")), expiresInDays },
      });
      setCreating(false);
      setCreatedKey(key);
      await router.invalidate();
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }

  return (
    <HydratedFieldset className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg">{t("api_keys")}</h2>
          <p className="text-muted-foreground text-sm">{t("api_key_modal_subtitle")}</p>
        </div>
        {!creating && !createdKey && <Button onClick={() => setCreating(true)}>{t("create_api_key")}</Button>}
      </div>
      {createdKey && <CreatedKey apiKey={createdKey} onDone={() => setCreatedKey(null)} />}
      {creating && (
        <form method="post" onSubmit={onCreate} className="flex flex-col gap-4 rounded-lg border p-4">
          <label className="flex flex-col gap-1.5 font-medium text-sm">
            {t("personal_note")}
            <Input name="name" required maxLength={100} placeholder={t("personal_note_placeholder")} />
          </label>
          <label className="flex flex-col gap-1.5 font-medium text-sm">
            {t("expire_date")}
            <select
              className={selectClass}
              value={expiresInDays ?? "never"}
              onChange={(event) =>
                setExpiresInDays(
                  event.target.value === "never" ? null : (Number(event.target.value) as ExpiryDays)
                )
              }>
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.labelKey} value={option.days ?? "never"}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <FormError message={errorKey && t(errorKey)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit">{t("create")}</Button>
          </div>
        </form>
      )}
      {keys.length === 0 && !creating ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">{t("create_first_api_key")}</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("create_first_api_key_description", { appName: "Cal.diy" })}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border" data-testid="api-keys">
          {keys.map((key) => {
            const expired = key.expiresAt !== null && new Date(key.expiresAt) < new Date();
            return (
              <li key={key.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <KeyRoundIcon className="size-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{key.name}</p>
                    <p className="text-muted-foreground">
                      <code>{key.hint}</code> · {expired && t("expired")}
                      {!expired &&
                        key.expiresAt &&
                        `${t("expires")} ${dateFormat.format(new Date(key.expiresAt))}`}
                      {!key.expiresAt && t("never_expires")}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("delete")}
                  onClick={async () => {
                    await deleteApiKey({ data: { keyId: key.id } });
                    await router.invalidate();
                  }}>
                  <TrashIcon />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/developer/api-keys")({
  loader: async ({ context }) => {
    const [messages, keys] = await Promise.all([loadMessages(context, MESSAGE_KEYS), listApiKeys()]);
    return { messages, keys };
  },
  component: ApiKeysPage,
});

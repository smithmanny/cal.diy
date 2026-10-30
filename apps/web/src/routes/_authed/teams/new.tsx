import slugify from "@calcom/lib/slugify";
import { Button } from "@coss/ui/components/button";
import { Label } from "@coss/ui/components/label";
import { Switch } from "@coss/ui/components/switch";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { PageHeader } from "~/components/AppShell";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { TextField } from "~/components/TextField";
import { TEAM_FORM_MESSAGE_KEYS } from "~/components/teams/messages";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { createTeam } from "~/server/teams/functions";

function NewTeamPage() {
  const t = useT();
  const navigate = useNavigate();
  const { parentId } = Route.useSearch();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [isOrganization, setIsOrganization] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrorKey(null);
    try {
      const { id } = await createTeam({ data: { name, slug, isOrganization, parentId } });
      await navigate({ to: "/teams/$teamId", params: { teamId: id } });
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }

  return (
    <HydratedFieldset>
      <PageHeader title={t(isOrganization ? "create_organization" : "create_new_team")} />
      <form onSubmit={submit} className="flex max-w-lg flex-col gap-4">
        <FormError message={errorKey && t(errorKey)} />
        <TextField
          label={t("team_name")}
          required
          maxLength={100}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
        />
        <TextField
          label={t("team_url")}
          hint={`/team/${slug}`}
          required
          maxLength={100}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(slugify(event.target.value, true));
          }}
        />
        {!parentId && (
          <Label className="flex items-center gap-2">
            <Switch checked={isOrganization} onCheckedChange={setIsOrganization} />
            {t("organization_toggle")}
          </Label>
        )}
        <div>
          <Button type="submit">{t(isOrganization ? "create_organization" : "create_team")}</Button>
        </div>
      </form>
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/teams/new")({
  validateSearch: (search: Record<string, unknown>): { parentId?: number } => {
    const parentId = Number(search.parentId);
    return { parentId: Number.isInteger(parentId) && parentId > 0 ? parentId : undefined };
  },
  loader: async ({ context }) => ({ messages: await loadMessages(context, TEAM_FORM_MESSAGE_KEYS) }),
  component: NewTeamPage,
});

import slugify from "@calcom/lib/slugify";
import { Button } from "@coss/ui/components/button";
import { Label } from "@coss/ui/components/label";
import { Textarea } from "@coss/ui/components/textarea";
import { type FormEvent, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { TextField } from "~/components/TextField";
import { useT } from "~/lib/i18n";
import { updateTeam } from "~/server/teams/functions";
import { useTeamAction } from "./useTeamAction";

type Team = { id: number; name: string; slug: string | null; bio: string | null };

export function TeamProfileForm({ team, editable }: { team: Team; editable: boolean }) {
  const t = useT();
  const { run, errorKey } = useTeamAction();
  const [name, setName] = useState(team.name);
  const [slug, setSlug] = useState(team.slug ?? "");
  const [bio, setBio] = useState(team.bio ?? "");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setSaved(await run(() => updateTeam({ data: { teamId: team.id, name, slug, bio: bio.trim() || null } })));
  }

  return (
    <form onSubmit={submit} className="flex max-w-lg flex-col gap-4">
      <FormError message={errorKey && t(errorKey)} />
      {saved && (
        <p role="status" className="text-sm">
          {t("team_updated_successfully")}
        </p>
      )}
      <fieldset disabled={!editable} className="flex flex-col gap-4">
        <TextField
          label={t("team_name")}
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label={t("team_url")}
          hint={`/team/${slug}`}
          required
          maxLength={100}
          value={slug}
          onChange={(event) => setSlug(slugify(event.target.value, true))}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="team-bio">{t("about")}</Label>
          <Textarea
            id="team-bio"
            maxLength={1000}
            placeholder={t("team_description")}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
        </div>
        {editable && (
          <div>
            <Button type="submit">{t("save_changes")}</Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}

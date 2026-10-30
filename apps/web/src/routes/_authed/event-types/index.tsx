import slugify from "@calcom/lib/slugify";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Switch } from "@coss/ui/components/switch";
import { Textarea } from "@coss/ui/components/textarea";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { CopyIcon, ExternalLinkIcon, PlusIcon, TrashIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { PageHeader } from "~/components/AppShell";
import { FormError } from "~/components/AuthCard";
import { EventColorBar } from "~/components/EventColorBar";
import { TEAM_EVENT_TYPES_MESSAGE_KEYS, TeamEventTypes } from "~/components/event-types/TeamEventTypes";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import {
  createEventType,
  deleteEventType,
  listEventTypes,
  listTeamEventTypes,
  setEventTypeHidden,
} from "~/server/event-types/functions";

const MESSAGE_KEYS = [
  ...TEAM_EVENT_TYPES_MESSAGE_KEYS,
  "event_types_page_title",
  "event_types_page_subtitle",
  "new_event_type_btn",
  "no_event_types",
  "title",
  "url",
  "description",
  "duration",
  "minutes",
  "create",
  "cancel",
  "hidden",
  "hide_from_profile",
  "copy_link",
  "link_copied",
  "preview",
  "delete",
  "delete_event_type",
  "delete_event_type_description",
  "url_taken",
  "something_went_wrong",
];

function NewEventTypeForm({ prefix, onCancel }: { prefix: string; onCancel: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const { id } = await createEventType({
        data: {
          title,
          slug,
          length: Number(form.get("length")),
          description: String(form.get("description") || "") || null,
        },
      });
      await navigate({ to: "/event-types/$eventTypeId", params: { eventTypeId: id } });
    } catch (error) {
      setErrorKey(errorMessageKey(error));
      setPending(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="mb-6 grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("title")}
        <Input
          required
          maxLength={200}
          autoFocus
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
        />
      </label>
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("url")}
        <div className="flex items-center gap-1">
          <span className="truncate text-muted-foreground text-xs">{prefix}</span>
          <Input
            required
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(slugify(event.target.value, true));
            }}
          />
        </div>
      </label>
      <label className="flex flex-col gap-1.5 font-medium text-sm sm:col-span-2">
        {t("description")}
        <Textarea name="description" maxLength={5000} rows={2} />
      </label>
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("duration")} ({t("minutes")})
        <Input name="length" type="number" min={1} max={1440} defaultValue={15} required />
      </label>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={pending}>
          {t("create")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <FormError message={errorKey && t(errorKey)} />
      </div>
    </form>
  );
}

function EventTypesPage() {
  const { eventTypes, teamGroups } = Route.useLoaderData();
  const { user, origin } = Route.useRouteContext();
  const t = useT();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const prefix = `${origin}/${user.username ?? ""}/`;

  async function run(action: () => Promise<unknown>) {
    setErrorKey(null);
    try {
      await action();
      await router.invalidate();
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }

  return (
    <HydratedFieldset>
      <PageHeader
        title={t("event_types_page_title")}
        description={t("event_types_page_subtitle")}
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon />
            {t("new_event_type_btn")}
          </Button>
        }
      />
      {creating && <NewEventTypeForm prefix={prefix} onCancel={() => setCreating(false)} />}
      <FormError message={errorKey && t(errorKey)} />
      {eventTypes.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          {t("no_event_types")}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {eventTypes.map((eventType) => {
            const url = `${prefix}${eventType.slug}`;
            return (
              <li key={eventType.id} className="flex flex-wrap items-center gap-4 p-4">
                <EventColorBar color={eventType.eventTypeColor} />
                <Link
                  to="/event-types/$eventTypeId"
                  params={{ eventTypeId: eventType.id }}
                  className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2 font-medium">
                    {eventType.title}
                    <span className="truncate font-normal text-muted-foreground text-xs">
                      /{user.username}/{eventType.slug}
                    </span>
                  </span>
                  {eventType.description && (
                    <span className="line-clamp-1 text-muted-foreground text-sm">
                      {eventType.description}
                    </span>
                  )}
                  <span className="flex gap-2">
                    <Badge variant="secondary">
                      {eventType.length} {t("minutes")}
                    </Badge>
                    {eventType.hidden && <Badge variant="outline">{t("hidden")}</Badge>}
                  </span>
                </Link>
                <div className="flex items-center gap-1">
                  <label className="mr-2 flex items-center gap-2 text-muted-foreground text-xs">
                    <Switch
                      aria-label={t("hide_from_profile")}
                      checked={!eventType.hidden}
                      onCheckedChange={(visible) =>
                        run(() => setEventTypeHidden({ data: { id: eventType.id, hidden: !visible } }))
                      }
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("preview")}
                    render={<a href={url} target="_blank" rel="noreferrer" />}>
                    <ExternalLinkIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copied === eventType.id ? t("link_copied") : t("copy_link")}
                    onClick={async () => {
                      await navigator.clipboard.writeText(url);
                      setCopied(eventType.id);
                    }}>
                    <CopyIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("delete")}
                    onClick={() => {
                      if (
                        window.confirm(`${t("delete_event_type")}\n\n${t("delete_event_type_description")}`)
                      ) {
                        run(() => deleteEventType({ data: { id: eventType.id } }));
                      }
                    }}>
                    <TrashIcon />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <TeamEventTypes groups={teamGroups} />
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/event-types/")({
  loader: async ({ context }) => {
    const [messages, eventTypes, teamGroups] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      listEventTypes(),
      listTeamEventTypes(),
    ]);
    return { messages, eventTypes, teamGroups };
  },
  component: EventTypesPage,
});

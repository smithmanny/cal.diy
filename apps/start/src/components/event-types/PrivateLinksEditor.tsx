import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { CopyIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { TFunction } from "~/lib/i18n";
import type { EventTypeInput } from "~/server/event-types/types";
import { type SetField, ToggleBlock, withoutLinks } from "./EditorLayout";

type PrivateLink = EventTypeInput["privateLinks"][number];

function newLink(): PrivateLink {
  return { link: crypto.randomUUID().replaceAll("-", ""), expiresAt: null, maxUsageCount: 1 };
}

function LinkRow({
  entry,
  url,
  onChange,
  onRemove,
  t,
}: {
  entry: PrivateLink;
  url: string;
  onChange: (entry: PrivateLink) => void;
  onRemove: () => void;
  t: TFunction;
}) {
  const dated = entry.expiresAt !== null;
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center gap-2">
        <Input readOnly value={url} aria-label={t("private_link_label")} className="font-mono text-xs" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("copy")}
          onClick={() => void navigator.clipboard?.writeText(url)}>
          <CopyIcon />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("remove")} onClick={onRemove}>
          <Trash2Icon />
        </Button>
      </div>
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="sr-only">{t("link_expires_after")}</legend>
        <label className="flex items-center gap-2">
          <input type="radio" checked={!dated} onChange={() => onChange({ ...entry, expiresAt: null })} />
          {t("max_usage_count")}
          <Input
            type="number"
            min={Math.max(1, entry.usageCount ?? 0)}
            className="w-20"
            aria-label={t("max_usage_count")}
            disabled={dated}
            value={entry.maxUsageCount}
            onChange={(event) =>
              onChange({ ...entry, maxUsageCount: Math.max(1, Math.floor(Number(event.target.value) || 1)) })
            }
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={dated}
            onChange={() => onChange({ ...entry, expiresAt: new Date().toISOString().slice(0, 10) })}
          />
          {t("expires_on")}
          <Input
            type="date"
            className="w-40"
            aria-label={t("expires_on")}
            disabled={!dated}
            value={entry.expiresAt ?? ""}
            onChange={(event) => onChange({ ...entry, expiresAt: event.target.value || null })}
          />
        </label>
        {!dated && entry.usageCount !== undefined && (
          <span className="text-muted-foreground text-xs">
            {entry.usageCount}/{entry.maxUsageCount}
          </span>
        )}
      </fieldset>
    </li>
  );
}

/** Cal's private links: URLs that hide the username and expire by date or after some bookings. */
export function PrivateLinksEditor({
  form,
  set,
  origin,
  t,
}: {
  form: EventTypeInput;
  set: SetField;
  origin: string;
  t: TFunction;
}) {
  const links = form.privateLinks;
  const update = (index: number, entry: PrivateLink) =>
    set(
      "privateLinks",
      links.map((current, i) => (i === index ? entry : current))
    );
  return (
    <ToggleBlock
      title={t("multiple_private_links_title")}
      description={withoutLinks(t("multiple_private_links_description"))}
      checked={links.length > 0}
      onCheckedChange={(checked) => set("privateLinks", checked ? [newLink()] : [])}>
      <div className="flex flex-col gap-2">
        <ul className="flex flex-col gap-2">
          {links.map((entry, index) => (
            <LinkRow
              key={entry.link}
              entry={entry}
              url={`${origin}/d/${entry.link}/${form.slug}`}
              onChange={(changed) => update(index, changed)}
              onRemove={() =>
                set(
                  "privateLinks",
                  links.filter((_, i) => i !== index)
                )
              }
              t={t}
            />
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => set("privateLinks", [...links, newLink()])}>
          <PlusIcon />
          {t("add_a_multiple_private_link")}
        </Button>
      </div>
    </ToggleBlock>
  );
}

export const PRIVATE_LINKS_MESSAGE_KEYS = [
  "multiple_private_links_title",
  "multiple_private_links_description",
  "private_link_label",
  "add_a_multiple_private_link",
  "link_expires_after",
  "max_usage_count",
  "expires_on",
  "copy",
  "remove",
  "usage_count_error",
];

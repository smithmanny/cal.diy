import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Switch } from "@coss/ui/components/switch";
import { Textarea } from "@coss/ui/components/textarea";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PencilIcon, TrashIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { selectClass } from "~/components/availability/TimeSelect";
import { HOLIDAY_MESSAGE_KEYS, HolidaySettings } from "~/components/HolidaySettings";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { getHolidaySettings } from "~/server/holidays/functions";
import { deleteOutOfOffice, listOutOfOffice, saveOutOfOffice } from "~/server/out-of-office/functions";

const MESSAGE_KEYS = [
  "out_of_office",
  "out_of_office_description",
  "create_an_out_of_office",
  "edit_an_out_of_office",
  "ooo_empty_title",
  "ooo_empty_description",
  "date",
  "to",
  "reason",
  "notes",
  "show_note_publicly_description",
  "save",
  "cancel",
  "edit",
  "delete",
  "success_entry_created",
  "success_edited_entry_out_of_office",
  "success_deleted_entry_out_of_office",
  "out_of_office_entry_already_exists",
  "start_date_must_be_before_end_date",
  "ooo_reasons_unspecified",
  "ooo_reasons_vacation",
  "ooo_reasons_travel",
  "ooo_reasons_sick_leave",
  "ooo_reasons_public_holiday",
  "redirect_team_enabled",
  "select_team_member",
  "cannot_redirect_to_self",
  "something_went_wrong",
  ...HOLIDAY_MESSAGE_KEYS,
];

type Data = Awaited<ReturnType<typeof listOutOfOffice>>;
type Entry = Data["entries"][number];

function EntryForm({
  entry,
  reasons,
  teammates,
  onDone,
  onCancel,
}: {
  entry: Entry | null;
  reasons: Data["reasons"];
  teammates: Data["teammates"];
  onDone: (messageKey: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [showNotePublicly, setShowNotePublicly] = useState(entry?.showNotePublicly ?? false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);
    try {
      await saveOutOfOffice({
        data: {
          uuid: entry?.uuid,
          startDate: String(form.get("startDate")),
          endDate: String(form.get("endDate")),
          reasonId: Number(form.get("reasonId")),
          notes: String(form.get("notes") ?? "") || null,
          showNotePublicly,
          toUserId: Number(form.get("toUserId")) || null,
        },
      });
      onDone(entry ? "success_edited_entry_out_of_office" : "success_entry_created");
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="font-medium">{entry ? t("edit_an_out_of_office") : t("create_an_out_of_office")}</h2>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("date")}
          <Input type="date" name="startDate" required defaultValue={entry?.startDate} />
        </label>
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("to")}
          <Input type="date" name="endDate" required defaultValue={entry?.endDate} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("reason")}
        <select name="reasonId" className={selectClass} defaultValue={entry?.reasonId ?? reasons[0]?.id}>
          {reasons.map((reason) => (
            <option key={reason.id} value={reason.id}>
              {reason.emoji} {t(reason.reason)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("notes")}
        <Textarea name="notes" rows={3} maxLength={1000} defaultValue={entry?.notes ?? ""} />
      </label>
      {teammates.length > 0 && (
        <label className="flex flex-col gap-1.5 font-medium text-sm">
          {t("redirect_team_enabled")}
          <select name="toUserId" className={selectClass} defaultValue={entry?.toUserId ?? ""}>
            <option value="">{t("select_team_member")}</option>
            {teammates.map((teammate) => (
              <option key={teammate.id} value={teammate.id}>
                {teammate.name || teammate.email}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={showNotePublicly} onCheckedChange={setShowNotePublicly} />
        {t("show_note_publicly_description")}
      </label>
      <FormError message={errorKey && t(errorKey)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit">{t("save")}</Button>
      </div>
    </form>
  );
}

function OutOfOfficePage() {
  const { data, holidays } = Route.useLoaderData();
  const { locale } = Route.useRouteContext();
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState<Entry | "new" | null>(null);
  const [statusKey, setStatusKey] = useState<string | null>(null);
  // Entries are whole UTC days, so format them in UTC to show the dates the host picked.
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

  async function finish(messageKey: string) {
    setEditing(null);
    setStatusKey(messageKey);
    await router.invalidate();
  }

  return (
    <HydratedFieldset className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg">{t("out_of_office")}</h2>
          <p className="text-muted-foreground text-sm">{t("out_of_office_description")}</p>
        </div>
        {editing === null && (
          <Button onClick={() => setEditing("new")}>{t("create_an_out_of_office")}</Button>
        )}
      </div>
      {statusKey && (
        <p role="status" className="text-sm text-success-foreground">
          {t(statusKey)}
        </p>
      )}
      {editing !== null && (
        <EntryForm
          key={editing === "new" ? "new" : editing.uuid}
          entry={editing === "new" ? null : editing}
          reasons={data.reasons}
          teammates={data.teammates}
          onDone={finish}
          onCancel={() => setEditing(null)}
        />
      )}
      {data.entries.length === 0 && editing === null ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">{t("ooo_empty_title")}</p>
          <p className="mt-1 text-muted-foreground text-sm">{t("ooo_empty_description")}</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border" data-testid="ooo-entries">
          {data.entries.map((entry) => (
            <li key={entry.uuid} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-muted" aria-hidden>
                  {entry.emoji ?? "🏝️"}
                </span>
                <div>
                  <p className="font-medium">
                    {dateFormat.format(new Date(entry.start))} - {dateFormat.format(new Date(entry.end))}
                  </p>
                  <p className="text-muted-foreground">
                    {entry.reason ? t(entry.reason) : null}
                    {entry.notes ? ` · ${entry.notes}` : null}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("edit")}
                  onClick={() => setEditing(entry)}>
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("delete")}
                  onClick={async () => {
                    await deleteOutOfOffice({ data: { uuid: entry.uuid } });
                    await finish("success_deleted_entry_out_of_office");
                  }}>
                  <TrashIcon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {holidays.enabled && <HolidaySettings settings={holidays} locale={locale} />}
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/my-account/out-of-office")({
  loader: async ({ context }) => {
    const [messages, data, holidays] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      listOutOfOffice(),
      getHolidaySettings(),
    ]);
    return { messages, data, holidays };
  },
  component: OutOfOfficePage,
});

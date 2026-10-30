import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Textarea } from "@coss/ui/components/textarea";
import { type FormEvent, type ReactNode, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { WeeklyHoursEditor } from "~/components/availability/WeeklyHoursEditor";
import { TimeZoneSelect } from "~/components/TimeZoneSelect";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import type { ScheduleDto } from "~/server/schedules/types";

const AVATAR_SIZE = 200;

/** Scales the picked image down to Cal's avatar size, as a data URL small enough to upload. */
async function resizeAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  const side = Math.min(bitmap.width, bitmap.height);
  context?.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  );
  return canvas.toDataURL("image/png");
}

/** Submits a step and moves on; failures stay on the step with their message. */
function useStep(next: () => Promise<unknown>) {
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  async function submit(action: () => Promise<unknown>) {
    setPending(true);
    setErrorKey(null);
    try {
      await action();
      await next();
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    } finally {
      setPending(false);
    }
  }
  return { pending, errorKey, submit };
}

function StepForm({
  onSubmit,
  errorKey,
  pending,
  submitLabel,
  extra,
  children,
}: {
  onSubmit: () => void;
  errorKey: string | null;
  pending: boolean;
  submitLabel: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}>
      {children}
      <FormError message={errorKey && t(errorKey)} />
      <Button type="submit" disabled={pending} className="w-full">
        {submitLabel}
      </Button>
      {extra}
    </form>
  );
}

export function UserSettingsStep({
  initial,
  save,
  next,
}: {
  initial: { name: string; username: string; timeZone: string };
  save: (values: { name: string; username: string; timeZone: string }) => Promise<unknown>;
  next: () => Promise<unknown>;
}) {
  const t = useT();
  const [values, setValues] = useState(initial);
  const { pending, errorKey, submit } = useStep(next);
  return (
    <StepForm
      onSubmit={() => submit(() => save(values))}
      errorKey={errorKey}
      pending={pending}
      submitLabel={t("next_step_text")}>
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("username")}
        <Input
          required
          maxLength={100}
          value={values.username}
          onChange={(event) => setValues({ ...values, username: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("full_name")}
        <Input
          required
          maxLength={200}
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("timezone")}
        <TimeZoneSelect value={values.timeZone} onChange={(timeZone) => setValues({ ...values, timeZone })} />
      </label>
    </StepForm>
  );
}

export function CalendarStep({
  enabled,
  connections,
  next,
}: {
  enabled: boolean;
  connections: { credentialId: number; calendars: { name: string; primary: boolean }[] }[];
  next: () => Promise<unknown>;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      {connections.map((connection) => (
        <p key={connection.credentialId} className="rounded-lg border p-3 text-sm">
          {t("google_calendar")}:{" "}
          {(connection.calendars.find((calendar) => calendar.primary) ?? connection.calendars[0])?.name}
        </p>
      ))}
      {enabled && connections.length === 0 && (
        <Button
          variant="outline"
          render={
            <a href="/api/integrations/googlecalendar/add?returnTo=/getting-started/connected-calendar" />
          }>
          {t("connect")} {t("google_calendar")}
        </Button>
      )}
      <Button onClick={() => next()} variant={connections.length ? "default" : "ghost"}>
        {connections.length ? t("next_step_text") : t("set_up_later")}
      </Button>
    </div>
  );
}

export function AvailabilityStep({
  schedule,
  timeZone,
  locale,
  save,
  next,
}: {
  schedule: ScheduleDto;
  timeZone: string;
  locale: string;
  save: (schedule: ScheduleDto) => Promise<unknown>;
  next: () => Promise<unknown>;
}) {
  const t = useT();
  const [weeklyHours, setWeeklyHours] = useState(schedule.weeklyHours);
  const { pending, errorKey, submit } = useStep(next);
  return (
    <StepForm
      // Like Cal, the first schedule follows the time zone chosen in the first step.
      onSubmit={() => submit(() => save({ ...schedule, timeZone, weeklyHours }))}
      errorKey={errorKey}
      pending={pending}
      submitLabel={t("next_step_text")}>
      <WeeklyHoursEditor value={weeklyHours} onChange={setWeeklyHours} locale={locale} t={t} />
    </StepForm>
  );
}

export function ProfileStep({
  initial,
  finish,
  next,
}: {
  initial: { bio: string; avatarUrl: string | null };
  finish: (values: { bio: string; avatar: string | null }) => Promise<unknown>;
  next: () => Promise<unknown>;
}) {
  const t = useT();
  const [bio, setBio] = useState(initial.bio);
  const [avatar, setAvatar] = useState<string | null>(null);
  const { pending, errorKey, submit } = useStep(next);
  const preview = avatar ?? initial.avatarUrl;
  return (
    <StepForm
      onSubmit={() => submit(() => finish({ bio, avatar }))}
      errorKey={errorKey}
      pending={pending}
      submitLabel={t("finish")}>
      <div className="flex items-center gap-4">
        {preview ? (
          <img src={preview} alt={t("profile_picture")} className="size-16 rounded-full object-cover" />
        ) : (
          <div className="size-16 rounded-full bg-muted" />
        )}
        <label className="cursor-pointer font-medium text-sm underline">
          {t("upload_avatar")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) setAvatar(await resizeAvatar(file));
            }}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 font-medium text-sm">
        {t("about")}
        <Textarea value={bio} maxLength={1000} onChange={(event) => setBio(event.target.value)} />
        <span className="font-normal text-muted-foreground text-xs">{t("few_sentences_about_yourself")}</span>
      </label>
    </StepForm>
  );
}

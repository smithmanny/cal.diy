import { Button } from "@coss/ui/components/button";
import { Switch } from "@coss/ui/components/switch";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import {
  disconnectCalendar,
  getCalendarSettings,
  setCalendarSelected,
  setDestinationCalendar,
} from "~/server/calendars/functions";

const MESSAGE_KEYS = [
  "calendars",
  "connect_your_calendar",
  "connect_your_calendar_instructions",
  "toggle_calendars_conflict",
  "google_calendar",
  "google_calendar_not_configured",
  "connect",
  "disconnect",
  "check_for_conflicts",
  "add_events_to",
  "calendar_connection_fail",
  "something_went_wrong",
  "not_found",
];

function CalendarsPage() {
  const { settings } = Route.useLoaderData();
  const { error } = Route.useSearch();
  const t = useT();
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(error ?? null);

  async function run(action: () => Promise<unknown>) {
    setErrorKey(null);
    try {
      await action();
      await router.invalidate();
    } catch (failure) {
      setErrorKey(errorMessageKey(failure));
    }
  }

  if (!settings.enabled) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
        {t("google_calendar_not_configured")}
      </p>
    );
  }

  return (
    <HydratedFieldset className="flex flex-col gap-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
        <div>
          <h2 className="font-medium">{t("connect_your_calendar")}</h2>
          <p className="text-muted-foreground text-sm">{t("connect_your_calendar_instructions")}</p>
        </div>
        {/* A full page navigation: the OAuth flow leaves the app for Google and comes back. */}
        <Button render={<a href="/api/integrations/googlecalendar/add" />}>
          <CalendarIcon />
          {t("connect")} {t("google_calendar")}
        </Button>
      </section>
      <FormError message={errorKey && t(errorKey)} />
      {settings.connections.map((connection) => (
        <section key={connection.credentialId} className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">{t("google_calendar")}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                run(() => disconnectCalendar({ data: { credentialId: connection.credentialId } }))
              }>
              {t("disconnect")}
            </Button>
          </div>
          {connection.error ? (
            <FormError message={t("calendar_connection_fail")} />
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{t("toggle_calendars_conflict")}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground text-xs">
                    <th className="py-1 font-normal" />
                    <th className="py-1 font-normal">{t("check_for_conflicts")}</th>
                    <th className="py-1 font-normal">{t("add_events_to")}</th>
                  </tr>
                </thead>
                <tbody>
                  {connection.calendars.map((calendar) => (
                    <tr key={calendar.id} className="border-t">
                      <td className="py-2 pr-2">{calendar.name}</td>
                      <td className="py-2">
                        <Switch
                          aria-label={`${t("check_for_conflicts")}: ${calendar.name}`}
                          checked={calendar.selected}
                          onCheckedChange={(selected) =>
                            run(() =>
                              setCalendarSelected({
                                data: {
                                  credentialId: connection.credentialId,
                                  calendarId: calendar.id,
                                  selected,
                                },
                              })
                            )
                          }
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="radio"
                          name="destination"
                          aria-label={`${t("add_events_to")}: ${calendar.name}`}
                          checked={calendar.destination}
                          onChange={() =>
                            run(() =>
                              setDestinationCalendar({
                                data: { credentialId: connection.credentialId, calendarId: calendar.id },
                              })
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      ))}
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/my-account/calendars")({
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    error: typeof search.error === "string" && /^[a-z_]+$/.test(search.error) ? search.error : undefined,
  }),
  loader: async ({ context }) => {
    const [messages, settings] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getCalendarSettings(),
    ]);
    return { messages, settings };
  },
  component: CalendarsPage,
});

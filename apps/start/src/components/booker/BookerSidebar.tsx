import { ClockIcon, GlobeIcon, MapPinIcon } from "lucide-react";
import type { TFunction } from "~/lib/i18n";
import { LOCATION_LABEL_KEYS } from "~/lib/location-labels";
import type { PublicEventDto } from "~/server/bookings/types";
import { TimeZoneSelect } from "../TimeZoneSelect";

export function BookerSidebar({
  event,
  rescheduling,
  timeZone,
  onTimeZoneChange,
  t,
}: {
  event: PublicEventDto;
  rescheduling: boolean;
  timeZone: string | null;
  onTimeZoneChange: (timeZone: string) => void;
  t: TFunction;
}) {
  const { eventType, host } = event;
  return (
    <aside className="flex flex-col gap-3 border-b p-6 md:border-r md:border-b-0">
      <p className="text-muted-foreground text-sm">{host.name ?? host.username}</p>
      <h1 className="font-heading text-xl">{eventType.title}</h1>
      {rescheduling && <p className="font-medium text-sm">{t("reschedule_booking")}</p>}
      {eventType.description && (
        <p className="whitespace-pre-line text-muted-foreground text-sm">{eventType.description}</p>
      )}
      <p className="flex items-center gap-2 text-sm">
        <ClockIcon className="size-4 text-muted-foreground" />
        {eventType.length} {t("minutes")}
      </p>
      {eventType.locations.map((location) => (
        <p key={location.type} className="flex items-center gap-2 text-sm">
          <MapPinIcon className="size-4 text-muted-foreground" />
          {location.address ?? t(LOCATION_LABEL_KEYS[location.type] ?? location.type)}
        </p>
      ))}
      {eventType.requiresConfirmation && (
        <p className="text-muted-foreground text-xs">{t("requires_confirmation")}</p>
      )}
      {timeZone && (
        <label className="mt-2 flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <GlobeIcon className="size-4" />
            {t("timezone")}
          </span>
          {eventType.lockedTimeZone ? (
            <span>{timeZone}</span>
          ) : (
            <TimeZoneSelect value={timeZone} onChange={onTimeZoneChange} />
          )}
        </label>
      )}
    </aside>
  );
}

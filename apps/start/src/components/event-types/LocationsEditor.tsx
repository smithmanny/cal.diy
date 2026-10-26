import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { LinkIcon, MapPinIcon, PhoneIcon, PlusIcon, TrashIcon, VideoIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { TFunction } from "~/lib/i18n";
import type { EventLocation } from "~/server/event-types/types";
import { selectClass } from "../availability/TimeSelect";

type LocationType = EventLocation["type"];

const LOCATION_OPTIONS: {
  type: LocationType;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { type: "integrations:google:meet", labelKey: "google_meet", icon: VideoIcon },
  { type: "inPerson", labelKey: "in_person_meeting", icon: MapPinIcon },
  { type: "link", labelKey: "link_meeting", icon: LinkIcon },
  { type: "phone", labelKey: "attendee_phone_number", icon: PhoneIcon },
  { type: "userPhone", labelKey: "organizer_phone_number", icon: PhoneIcon },
];

function emptyLocation(type: LocationType): EventLocation {
  switch (type) {
    case "inPerson":
      return { type, address: "" };
    case "link":
      return { type, link: "" };
    case "userPhone":
      return { type, hostPhoneNumber: "" };
    default:
      return { type };
  }
}

function LocationDetails({
  location,
  onChange,
  t,
}: {
  location: EventLocation;
  onChange: (location: EventLocation) => void;
  t: TFunction;
}) {
  switch (location.type) {
    case "inPerson":
      return (
        <Input
          aria-label={t("address")}
          placeholder={t("address")}
          value={location.address}
          onChange={(event) => onChange({ ...location, address: event.target.value })}
        />
      );
    case "link":
      return (
        <Input
          type="url"
          aria-label={t("meeting_url")}
          placeholder="https://"
          value={location.link}
          onChange={(event) => onChange({ ...location, link: event.target.value })}
        />
      );
    case "userPhone":
      return (
        <Input
          type="tel"
          aria-label={t("phone_number")}
          placeholder={t("phone_number")}
          value={location.hostPhoneNumber}
          onChange={(event) => onChange({ ...location, hostPhoneNumber: event.target.value })}
        />
      );
    default:
      return null;
  }
}

export const LOCATIONS_MESSAGE_KEYS = [
  "location",
  "add_location",
  "address",
  "meeting_url",
  "phone_number",
  "remove",
  ...LOCATION_OPTIONS.map((option) => option.labelKey),
];

export function LocationsEditor({
  value,
  onChange,
  t,
}: {
  value: EventLocation[];
  onChange: (value: EventLocation[]) => void;
  t: TFunction;
}) {
  const available = LOCATION_OPTIONS.filter(
    (option) => !value.some((location) => location.type === option.type)
  );

  return (
    <div className="flex flex-col gap-2">
      {value.map((location, index) => {
        const option = LOCATION_OPTIONS.find((o) => o.type === location.type);
        const Icon = option?.icon ?? MapPinIcon;
        return (
          <div key={location.type} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium text-sm">
                <Icon className="size-4 text-muted-foreground" />
                {option ? t(option.labelKey) : location.type}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("remove")}
                onClick={() => onChange(value.filter((_, i) => i !== index))}>
                <TrashIcon />
              </Button>
            </div>
            <LocationDetails
              location={location}
              t={t}
              onChange={(next) => onChange(value.map((current, i) => (i === index ? next : current)))}
            />
          </div>
        );
      })}
      {available.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <PlusIcon className="size-4 text-muted-foreground" />
          <select
            aria-label={t("add_location")}
            className={selectClass}
            value=""
            onChange={(event) => onChange([...value, emptyLocation(event.target.value as LocationType)])}>
            <option value="" disabled>
              {t("add_location")}
            </option>
            {available.map((option) => (
              <option key={option.type} value={option.type}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

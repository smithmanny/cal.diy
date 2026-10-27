import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { LinkIcon, MapPinIcon, PhoneIcon, PlusIcon, TrashIcon, VideoIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { TFunction } from "~/lib/i18n";
import type { ConferencingAppDto } from "~/server/apps/AppsService";
import type { EventLocation } from "~/server/event-types/types";
import { AppLogo } from "../AppLogo";
import { selectClass } from "../availability/TimeSelect";

type LocationType = EventLocation["type"];

type LocationOption = {
  type: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  logoUrl?: string;
  /** Static-link apps: the host's room link goes on the location. */
  needsLink?: boolean;
};

const BUILT_IN_OPTIONS: {
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

/** Built-in locations, then the host's installed conferencing apps (app names aren't translated). */
function locationOptions(apps: ConferencingAppDto[], t: TFunction): LocationOption[] {
  return [
    ...BUILT_IN_OPTIONS.map((option) => ({
      type: option.type,
      label: t(option.labelKey),
      icon: option.icon,
    })),
    ...apps.map((app) => ({
      type: app.locationType,
      label: app.name,
      logoUrl: app.logoUrl,
      needsLink: app.linkPattern !== null,
    })),
  ];
}

function emptyLocation(option: LocationOption): EventLocation {
  switch (option.type) {
    case "inPerson":
      return { type: "inPerson", address: "" };
    case "link":
      return { type: "link", link: "" };
    case "userPhone":
      return { type: "userPhone", hostPhoneNumber: "" };
    default:
      // The option list only offers location types the schema knows.
      return (option.needsLink ? { type: option.type, link: "" } : { type: option.type }) as EventLocation;
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
  if (location.type === "inPerson")
    return (
      <Input
        aria-label={t("address")}
        placeholder={t("address")}
        value={location.address}
        onChange={(event) => onChange({ ...location, address: event.target.value })}
      />
    );
  if (location.type === "userPhone")
    return (
      <Input
        type="tel"
        aria-label={t("phone_number")}
        placeholder={t("phone_number")}
        value={location.hostPhoneNumber}
        onChange={(event) => onChange({ ...location, hostPhoneNumber: event.target.value })}
      />
    );
  if ("link" in location)
    return (
      <Input
        type="url"
        aria-label={t("meeting_url")}
        placeholder="https://"
        value={location.link}
        onChange={(event) => onChange({ ...location, link: event.target.value })}
      />
    );
  return null;
}

function OptionIcon({ option }: { option: LocationOption | undefined }) {
  if (option?.logoUrl) return <AppLogo src={option.logoUrl} className="size-4" />;
  const Icon = option?.icon ?? MapPinIcon;
  return <Icon className="size-4 text-muted-foreground" />;
}

export const LOCATIONS_MESSAGE_KEYS = [
  "location",
  "add_location",
  "address",
  "meeting_url",
  "phone_number",
  "remove",
  ...BUILT_IN_OPTIONS.map((option) => option.labelKey),
];

export function LocationsEditor({
  value,
  onChange,
  apps,
  t,
}: {
  value: EventLocation[];
  onChange: (value: EventLocation[]) => void;
  /** The host's installed conferencing apps. */
  apps: ConferencingAppDto[];
  t: TFunction;
}) {
  const options = locationOptions(apps, t);
  const available = options.filter((option) => !value.some((location) => location.type === option.type));

  return (
    <div className="flex flex-col gap-2">
      {value.map((location, index) => {
        const option = options.find((o) => o.type === location.type);
        return (
          <div key={location.type} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium text-sm">
                <OptionIcon option={option} />
                {option?.label ?? location.type}
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
            onChange={(event) => {
              const option = available.find((candidate) => candidate.type === event.target.value);
              if (option) onChange([...value, emptyLocation(option)]);
            }}>
            <option value="" disabled>
              {t("add_location")}
            </option>
            {available.map((option) => (
              <option key={option.type} value={option.type}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

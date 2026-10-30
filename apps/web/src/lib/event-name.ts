/**
 * Port of Cal's getEventName: a booking's title from the event's name template, with Cal's
 * variables ({Event type title}, {Scheduler}, {Organiser}, {Location}, ...) and any booking
 * question's identifier, e.g. {company}.
 */

type EventNameInput = {
  /** The host's template, or null for Cal's "{eventName} between {host} and {attendeeName}". */
  template: string | null;
  eventTypeTitle: string;
  host: string;
  attendeeName: string;
  /** What the booker chose, already as a label (e.g. "Google Meet"). */
  locationLabel: string;
  eventDuration: number;
  responses: Record<string, unknown>;
  /** The translated "event_between_users" message. */
  defaultTemplate: string;
};

function responseText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("firstName" in record) return `${record.firstName ?? ""} ${record.lastName ?? ""}`.trim();
    return "value" in record ? String(record.value ?? "") : "";
  }
  return String(value);
}

export function getEventName(input: EventNameInput): string {
  if (!input.template)
    return input.defaultTemplate
      .replaceAll("{{eventName}}", input.eventTypeTitle)
      .replaceAll("{{host}}", input.host)
      .replaceAll("{{attendeeName}}", input.attendeeName);

  const named = input.template
    .replaceAll("{Location}", input.locationLabel)
    .replaceAll("{LOCATION}", input.locationLabel)
    .replaceAll("{Event type title}", input.eventTypeTitle)
    .replaceAll("{Scheduler}", input.attendeeName)
    .replaceAll("{Organiser}", input.host)
    .replaceAll("{Organiser first name}", input.host.split(" ")[0])
    .replaceAll("{USER}", input.attendeeName)
    .replaceAll("{ATTENDEE}", input.attendeeName)
    .replaceAll("{HOST}", input.host)
    .replaceAll("{HOST/ATTENDEE}", input.attendeeName)
    .replaceAll("{Event duration}", `${input.eventDuration} mins`)
    .replaceAll("{Scheduler first name}", input.attendeeName.split(" ")[0]);

  // Whatever is left in braces is a booking question; unanswered ones disappear, as in Cal.
  const withAnswers = named.replace(/\{(.+?)\}/g, (_, variable: string) =>
    variable === "location" ? input.locationLabel : responseText(input.responses[variable])
  );
  return withAnswers.trim() || input.eventTypeTitle;
}

import { Button } from "@coss/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@coss/ui/components/dialog";
import { Input } from "@coss/ui/components/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@coss/ui/components/menu";
import { Textarea } from "@coss/ui/components/textarea";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { selectClass } from "~/components/availability/TimeSelect";
import {
  emptyLocation,
  LOCATIONS_MESSAGE_KEYS,
  LocationDetails,
  locationOptions,
} from "~/components/event-types/LocationsEditor";
import { useT } from "~/lib/i18n";
import type { ConferencingAppDto } from "~/server/apps/AppsService";
import { getConferencingSettings } from "~/server/apps/functions";
import { addBookingGuests, editBookingLocation, requestReschedule } from "~/server/bookings/functions";
import {
  type EditableLocation,
  type EventLocation,
  editableLocationSchema,
} from "~/server/event-types/types";

type Action = "location" | "guests" | "reschedule";
type Run = (action: () => Promise<unknown>) => Promise<boolean>;

function ActionDialog({
  title,
  submitLabel,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  submitLabel: string;
  onSubmit: () => Promise<boolean>;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const done = await onSubmit();
    setPending(false);
    if (done) onClose();
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-3">{children}</DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>{t("cancel")}</DialogClose>
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

/** The attendee's phone isn't offered: the host can't move a booking onto a number they'd have to give. */
function toEditable(location: EventLocation): EditableLocation | null {
  if (location.type === "phone") return null;
  const trimmed = Object.fromEntries(
    Object.entries(location).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
  );
  const parsed = editableLocationSchema.safeParse(trimmed);
  return parsed.success ? parsed.data : null;
}

/** The host's installed conferencing apps (and the team's, for its events), as the event type editor offers. */
function useConferencingApps(teamId: number | null): ConferencingAppDto[] {
  const [apps, setApps] = useState<ConferencingAppDto[]>([]);
  useEffect(() => {
    let current = true;
    getConferencingSettings({ data: { teamId } }).then(
      (settings) => current && setApps(settings.apps),
      // Without them the built-in locations are still there to pick.
      () => {}
    );
    return () => {
      current = false;
    };
  }, [teamId]);
  return apps;
}

function LocationDialog({
  uid,
  teamId,
  run,
  onClose,
}: {
  uid: string;
  teamId: number | null;
  run: Run;
  onClose: () => void;
}) {
  const t = useT();
  const options = locationOptions(useConferencingApps(teamId), t).filter((option) => option.type !== "phone");
  const [location, setLocation] = useState<EventLocation>({ type: "inPerson", address: "" });
  const [invalid, setInvalid] = useState(false);
  return (
    <ActionDialog
      title={t("edit_location")}
      submitLabel={t("update_location")}
      onClose={onClose}
      onSubmit={async () => {
        const editable = toEditable(location);
        setInvalid(!editable);
        return editable ? run(() => editBookingLocation({ data: { uid, location: editable } })) : false;
      }}>
      <select
        aria-label={t("new_location")}
        className={selectClass}
        value={location.type}
        onChange={(event) => {
          const option = options.find((candidate) => candidate.type === event.target.value);
          if (option) setLocation(emptyLocation(option));
        }}>
        {options.map((option) => (
          <option key={option.type} value={option.type}>
            {option.label}
          </option>
        ))}
      </select>
      <LocationDetails location={location} onChange={setLocation} t={t} />
      <FormError message={invalid ? t("invalid_input") : null} />
    </ActionDialog>
  );
}

function GuestsDialog({ uid, run, onClose }: { uid: string; run: Run; onClose: () => void }) {
  const t = useT();
  const [emails, setEmails] = useState("");
  const list = emails.split(/[\s,;]+/).filter(Boolean);
  return (
    <ActionDialog
      title={t("additional_guests")}
      submitLabel={t("add_emails")}
      onClose={onClose}
      onSubmit={() => run(() => addBookingGuests({ data: { uid, emails: list } }))}>
      <Input
        aria-label={t("guest_email")}
        placeholder="name@example.com, …"
        required
        value={emails}
        onChange={(event) => setEmails(event.target.value)}
      />
    </ActionDialog>
  );
}

function RescheduleDialog({ uid, run, onClose }: { uid: string; run: Run; onClose: () => void }) {
  const t = useT();
  const [reason, setReason] = useState("");
  return (
    <ActionDialog
      title={t("send_reschedule_request")}
      submitLabel={t("send_reschedule_request")}
      onClose={onClose}
      onSubmit={() => run(() => requestReschedule({ data: { uid, reason: reason.trim() || undefined } }))}>
      <Textarea
        aria-label={t("reason_for_reschedule_request")}
        placeholder={t("reason_for_reschedule_request")}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </ActionDialog>
  );
}

/** Cal's "Edit" menu on an upcoming booking: move it, add guests, or ask for a new time. */
export function BookingEditMenu({ uid, teamId, run }: { uid: string; teamId: number | null; run: Run }) {
  const t = useT();
  const [open, setOpen] = useState<Action | null>(null);
  const close = () => setOpen(null);
  return (
    <>
      <Menu>
        <MenuTrigger render={<Button size="sm" variant="outline" />}>{t("edit")}</MenuTrigger>
        <MenuPopup align="end">
          <MenuItem onClick={() => setOpen("location")}>{t("edit_location")}</MenuItem>
          <MenuItem onClick={() => setOpen("guests")}>{t("additional_guests")}</MenuItem>
          <MenuItem onClick={() => setOpen("reschedule")}>{t("send_reschedule_request")}</MenuItem>
        </MenuPopup>
      </Menu>
      {open === "location" && <LocationDialog uid={uid} teamId={teamId} run={run} onClose={close} />}
      {open === "guests" && <GuestsDialog uid={uid} run={run} onClose={close} />}
      {open === "reschedule" && <RescheduleDialog uid={uid} run={run} onClose={close} />}
    </>
  );
}

export const BOOKING_EDIT_MESSAGE_KEYS = [
  "edit",
  "edit_location",
  "update_location",
  "new_location",
  "additional_guests",
  "add_emails",
  "guest_email",
  "send_reschedule_request",
  "reason_for_reschedule_request",
  "cancel",
  "invalid_input",
  ...LOCATIONS_MESSAGE_KEYS,
];

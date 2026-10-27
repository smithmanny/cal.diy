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
import { type FormEvent, type ReactNode, useState } from "react";
import { selectClass } from "~/components/availability/TimeSelect";
import { useT } from "~/lib/i18n";
import { LOCATION_LABEL_KEYS } from "~/lib/location-labels";
import { addBookingGuests, editBookingLocation, requestReschedule } from "~/server/bookings/functions";
import type { EditableLocation } from "~/server/event-types/types";

type Action = "location" | "guests" | "reschedule";
type Run = (action: () => Promise<unknown>) => Promise<boolean>;

const LOCATION_TYPES = ["inPerson", "link", "userPhone", "integrations:google:meet"] as const;

function toLocation(type: (typeof LOCATION_TYPES)[number], value: string): EditableLocation {
  switch (type) {
    case "inPerson":
      return { type, address: value };
    case "link":
      return { type, link: value };
    case "userPhone":
      return { type, hostPhoneNumber: value };
    default:
      return { type };
  }
}

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

function LocationDialog({ uid, run, onClose }: { uid: string; run: Run; onClose: () => void }) {
  const t = useT();
  const [type, setType] = useState<(typeof LOCATION_TYPES)[number]>("inPerson");
  const [value, setValue] = useState("");
  const needsValue = type !== "integrations:google:meet";
  return (
    <ActionDialog
      title={t("edit_location")}
      submitLabel={t("update_location")}
      onClose={onClose}
      onSubmit={() =>
        run(() => editBookingLocation({ data: { uid, location: toLocation(type, value.trim()) } }))
      }>
      <select
        aria-label={t("new_location")}
        className={selectClass}
        value={type}
        onChange={(event) =>
          setType(LOCATION_TYPES.find((option) => option === event.target.value) ?? "inPerson")
        }>
        {LOCATION_TYPES.map((option) => (
          <option key={option} value={option}>
            {t(LOCATION_LABEL_KEYS[option])}
          </option>
        ))}
      </select>
      {needsValue && (
        <Input
          aria-label={t(LOCATION_LABEL_KEYS[type])}
          type={type === "link" ? "url" : "text"}
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      )}
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
export function BookingEditMenu({ uid, run }: { uid: string; run: Run }) {
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
      {open === "location" && <LocationDialog uid={uid} run={run} onClose={close} />}
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
  ...LOCATION_TYPES.map((type) => LOCATION_LABEL_KEYS[type]),
];

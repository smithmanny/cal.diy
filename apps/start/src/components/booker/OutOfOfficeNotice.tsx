import { Link } from "@tanstack/react-router";
import type { TFunction } from "~/lib/i18n";
import type { OutOfOfficeDayDto } from "~/server/bookings/types";

/** Cal's away card: who is out, why, their public note, and who to book instead if they set one. */
export function OutOfOfficeNotice({ day, t }: { day: OutOfOfficeDayDto; t: TFunction }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-lg" aria-hidden>
        {day.emoji ?? "🏝️"}
      </span>
      <p className="font-medium">{t("ooo_user_is_ooo", { displayName: day.displayName ?? "" })}</p>
      {day.reason && <p className="text-muted-foreground text-xs">{t(day.reason)}</p>}
      {day.notes && <p className="break-words text-muted-foreground text-sm italic">{day.notes}</p>}
      {day.toUser && (
        <Link
          to="/$username"
          params={{ username: day.toUser.username }}
          className="mt-2 rounded-md border px-3 py-1.5 font-medium text-sm hover:bg-accent">
          {t("ooo_slots_book_with", { displayName: day.toUser.displayName ?? day.toUser.username })}
        </Link>
      )}
    </div>
  );
}

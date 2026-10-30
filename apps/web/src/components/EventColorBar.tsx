import type { CSSProperties } from "react";

/** The host's event type color as a thin bar, in the shade for the current theme. */
export function EventColorBar({
  color,
}: {
  color: { lightEventTypeColor: string; darkEventTypeColor: string } | null;
}) {
  if (!color) return null;
  const style = {
    "--event-color": color.lightEventTypeColor,
    "--event-color-dark": color.darkEventTypeColor,
  } as CSSProperties;
  return (
    <span
      aria-hidden
      style={style}
      className="w-1 shrink-0 self-stretch rounded-full bg-(--event-color) dark:bg-(--event-color-dark)"
    />
  );
}

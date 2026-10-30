import { z } from "zod";

/** Cal's BookerLayouts: how the booking page lays out days and times. */
const BOOKER_LAYOUTS = ["month_view", "week_view", "column_view"] as const;

type BookerLayout = (typeof BOOKER_LAYOUTS)[number];

const layoutSchema = z.enum(BOOKER_LAYOUTS);

const bookerLayoutsSchema = z
  .object({ enabledLayouts: z.array(layoutSchema).min(1).max(3), defaultLayout: layoutSchema })
  .refine((layouts) => layouts.enabledLayouts.includes(layouts.defaultLayout), {
    message: "bookerlayout_error_default_not_enabled",
  });

type BookerLayouts = z.infer<typeof bookerLayoutsSchema>;

/** Cal's default when neither the event nor the user chose: every view, month first. */
const DEFAULT_BOOKER_LAYOUTS: BookerLayouts = {
  enabledLayouts: [...BOOKER_LAYOUTS],
  defaultLayout: "month_view",
};

const LAYOUT_LABEL_KEYS: Record<BookerLayout, string> = {
  month_view: "bookerlayout_month_view",
  week_view: "bookerlayout_week_view",
  column_view: "bookerlayout_column_view",
};

function parseBookerLayouts(value: unknown): BookerLayouts | null {
  const parsed = bookerLayoutsSchema.safeParse(value);
  return parsed.success ? { ...parsed.data, enabledLayouts: [...new Set(parsed.data.enabledLayouts)] } : null;
}

/** The event's own layouts win, then the user's defaults, then Cal's (getBookerLayouts). */
function effectiveBookerLayouts(eventLayouts: unknown, userLayouts: unknown): BookerLayouts {
  return parseBookerLayouts(eventLayouts) ?? parseBookerLayouts(userLayouts) ?? DEFAULT_BOOKER_LAYOUTS;
}

/** Cal's ?layout= override, honored only for an enabled layout. */
function initialLayout(layouts: BookerLayouts, requested: unknown): BookerLayout {
  const parsed = layoutSchema.safeParse(requested);
  return parsed.success && layouts.enabledLayouts.includes(parsed.data) ? parsed.data : layouts.defaultLayout;
}

export type { BookerLayout, BookerLayouts };
export {
  BOOKER_LAYOUTS,
  bookerLayoutsSchema,
  DEFAULT_BOOKER_LAYOUTS,
  effectiveBookerLayouts,
  initialLayout,
  LAYOUT_LABEL_KEYS,
  parseBookerLayouts,
};

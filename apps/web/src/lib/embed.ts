import type { ThemePreference } from "./theme";

/**
 * The iframe side of Cal's embed protocol, which embed.js (packages/embeds/embed-core) speaks from
 * the host page. Cal's own iframe side (embed-iframe.ts) is tied to Next.js, so this reimplements
 * the part embed.js depends on: events go up as `{ originator: "CAL", fullType: "CAL:<ns>:<type>" }`
 * and commands come down as `{ originator: "CAL", method, arg }`.
 */

const ORIGINATOR = "CAL";

type EmbedEventMessage = {
  originator: typeof ORIGINATOR;
  type: string;
  namespace: string;
  fullType: string;
  data: unknown;
};

type ParentCommand =
  | { method: "parentKnowsIframeReady" }
  | { method: "ui"; arg: { theme?: ThemePreference | "auto" } }
  | {
      method: "connect";
      arg: { config: Record<string, unknown>; params: Record<string, string | string[]> };
    };

/**
 * The namespace embed.js gave this page, or null when it isn't embedded. embed.js puts it in the
 * `embed` query parameter and in the iframe's name, which outlives navigation inside the iframe.
 */
function embedNamespace(search: string, windowName: string): string | null {
  const fromQuery = new URLSearchParams(search).get("embed");
  if (fromQuery !== null) return fromQuery;
  const match = /^cal-embed=(.*)$/.exec(windowName);
  return match ? match[1] : null;
}

function embedEventMessage(namespace: string, type: string, data: unknown): EmbedEventMessage {
  return { originator: ORIGINATOR, type, namespace, fullType: `${ORIGINATOR}:${namespace}:${type}`, data };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The commands this page acts on; anything else posted to the window is ignored. */
function parseParentCommand(data: unknown): ParentCommand | null {
  if (!isRecord(data) || data.originator !== ORIGINATOR) return null;
  switch (data.method) {
    case "parentKnowsIframeReady":
      return { method: "parentKnowsIframeReady" };
    case "ui": {
      const arg = isRecord(data.arg) ? data.arg : {};
      const theme =
        arg.theme === "light" || arg.theme === "dark" || arg.theme === "auto" ? arg.theme : undefined;
      return { method: "ui", arg: { theme } };
    }
    case "connect": {
      const arg = isRecord(data.arg) ? data.arg : {};
      return {
        method: "connect",
        arg: {
          config: isRecord(arg.config) ? arg.config : {},
          params: isRecord(arg.params) ? (arg.params as Record<string, string | string[]>) : {},
        },
      };
    }
    default:
      return null;
  }
}

/** Cal's `theme` query parameter and `ui.theme` setting: "auto" follows the visitor's system. */
function embedTheme(value: string | null | undefined): ThemePreference | undefined {
  if (value === "light" || value === "dark") return value;
  if (value === "auto") return null;
  return undefined;
}

/**
 * The page URL after `connect`: embed.js reuses a prerendered iframe for a booking by sending the
 * query it would have loaded. iframeAttrs configure the iframe itself, not the page.
 */
function connectedSearch(
  current: string,
  arg: { config: Record<string, unknown>; params: Record<string, string | string[]> }
): string {
  const search = new URLSearchParams(current);
  const { iframeAttrs: _iframeAttrs, ...config } = arg.config;
  for (const [key, value] of Object.entries({ ...arg.params, ...config })) {
    search.delete(key);
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, String(item));
  }
  return search.toString();
}

/** Cal's bookingSuccessfulV2 payload, which only carries what an embedding site needs. */
function bookingSuccessfulPayload(booking: {
  uid: string;
  title: string;
  status: string;
  eventTypeId: number | null;
  startTimes: string[];
  durationMinutes: number;
}) {
  const occurrences = booking.startTimes.map((start) => ({
    startTime: start,
    endTime: new Date(new Date(start).getTime() + booking.durationMinutes * 60_000).toISOString(),
  }));
  const [first] = occurrences;
  const isRecurring = occurrences.length > 1;
  return {
    uid: booking.uid,
    title: booking.title,
    startTime: first?.startTime,
    endTime: first?.endTime,
    eventTypeId: booking.eventTypeId,
    status: booking.status,
    paymentRequired: false,
    isRecurring,
    ...(isRecurring ? { allBookings: occurrences } : {}),
  };
}

export type { ParentCommand };
export {
  embedNamespace,
  embedEventMessage,
  parseParentCommand,
  embedTheme,
  connectedSearch,
  bookingSuccessfulPayload,
};

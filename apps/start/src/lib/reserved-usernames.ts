/**
 * Booking pages live at /<username>, so a user named after a top-level route (or a static
 * folder) would shadow it or be unreachable.
 */
export const RESERVED_USERNAMES = new Set([
  "api",
  "apps",
  "assets",
  "auth",
  "availability",
  "booking",
  "bookings",
  "event-types",
  "fonts",
  "locales",
  "reschedule",
  "settings",
  "team",
  "workflows",
  "favicon.ico",
  "robots.txt",
]);

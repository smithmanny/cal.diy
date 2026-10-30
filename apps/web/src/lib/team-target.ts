/**
 * Team event types are booked through the same endpoints as a user's, with `team:<slug>` in
 * place of the username. Usernames are slugs, so they never contain a colon.
 */
const TEAM_TARGET_PREFIX = "team:";

export function teamTarget(teamSlug: string): string {
  return `${TEAM_TARGET_PREFIX}${teamSlug}`;
}

export function teamSlugOf(username: string): string | null {
  return username.startsWith(TEAM_TARGET_PREFIX) ? username.slice(TEAM_TARGET_PREFIX.length) : null;
}

/** The booking page for an event type of a user, a group link or a team. */
export function bookerPath(username: string, slug: string): string {
  const teamSlug = teamSlugOf(username);
  return teamSlug ? `/team/${teamSlug}/${slug}` : `/${username}/${slug}`;
}

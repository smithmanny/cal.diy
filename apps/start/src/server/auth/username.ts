import slugify from "@calcom/lib/slugify";
import type { UserRepository } from "../users/UserRepository";

const CANDIDATE_COUNT = 5;

export function normalizeUsername(raw: string): string {
  return slugify(raw.trim());
}

export function usernameFromEmail(email: string): string {
  return normalizeUsername(email.split("@")[0] ?? "") || "user";
}

/**
 * Picks the first free username out of `base` and a few randomly suffixed variants,
 * checked in a single query.
 */
export async function findAvailableUsername(
  users: Pick<UserRepository, "findTakenUsernamesWithoutOrganization">,
  base: string
): Promise<string> {
  const candidates = [
    base,
    ...Array.from({ length: CANDIDATE_COUNT }, () => `${base}-${Math.floor(1000 + Math.random() * 9000)}`),
  ];
  const taken = await users.findTakenUsernamesWithoutOrganization(candidates);
  const available = candidates.find((candidate) => !taken.has(candidate));
  return available ?? `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

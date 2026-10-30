import "@tanstack/react-start/server-only";
import { RESERVED_USERNAMES } from "~/lib/reserved-usernames";
import { normalizeUsername } from "../auth/username";
import { AppError } from "../errors";
import { isValidTimeZone } from "../schedules/scheduleMapper";
import type { OnboardingRepository } from "./OnboardingRepository";

/** Cal keeps avatars small: the browser resizes them before upload. */
const MAX_AVATAR_BYTES = 512 * 1024;
const AVATAR_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

type Deps = {
  repo: Pick<
    OnboardingRepository,
    "findState" | "isUsernameTaken" | "updateUser" | "updateProfile" | "saveAvatar" | "complete"
  >;
  newObjectKey?: () => string;
};

/** Cal's /getting-started: basic settings, a calendar, availability, then a short profile. */
export class OnboardingService {
  constructor(private readonly deps: Deps) {}

  async state(userId: number) {
    const found = await this.deps.repo.findState(userId);
    if (!found) throw new AppError("not_found", 404);
    return found;
  }

  async saveUserSettings(
    userId: number,
    input: { name: string; username: string; timeZone: string }
  ): Promise<{ username: string }> {
    const username = normalizeUsername(input.username);
    if (!username || RESERVED_USERNAMES.has(username)) throw new AppError("username_already_taken", 409);
    if (await this.deps.repo.isUsernameTaken(username, userId))
      throw new AppError("username_already_taken", 409);
    if (!isValidTimeZone(input.timeZone)) throw new AppError("invalid_timezone");
    await this.deps.repo.updateUser(userId, { name: input.name.trim(), username, timeZone: input.timeZone });
    return { username };
  }

  /** Saves the bio and, when given, a new avatar, then marks onboarding done. */
  async finish(userId: number, input: { bio: string; avatar: string | null }): Promise<void> {
    let avatarUrl: string | undefined;
    if (input.avatar) {
      if (!AVATAR_DATA_URL.test(input.avatar) || input.avatar.length > MAX_AVATAR_BYTES)
        throw new AppError("image_upload_error", 400);
      const objectKey = this.deps.newObjectKey?.() ?? crypto.randomUUID();
      await this.deps.repo.saveAvatar(userId, input.avatar, objectKey);
      avatarUrl = `/api/avatar/${objectKey}.png`;
    }
    await this.deps.repo.updateProfile(userId, { bio: input.bio.trim() || null, avatarUrl });
    await this.deps.repo.complete(userId);
  }
}

/** Decodes a stored avatar data URL for serving. */
export function decodeAvatar(dataUrl: string): { contentType: string; body: Uint8Array<ArrayBuffer> } | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) return null;
  const binary = atob(match[2]);
  const body = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) body[index] = binary.charCodeAt(index);
  return { contentType: match[1], body };
}

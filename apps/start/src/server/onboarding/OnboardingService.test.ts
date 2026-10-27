import { describe, expect, it, vi } from "vitest";
import { decodeAvatar, OnboardingService } from "./OnboardingService";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

function setup(taken: string[] = []) {
  const repo = {
    findState: vi.fn(async () => null),
    isUsernameTaken: vi.fn(async (username: string) => taken.includes(username)),
    updateUser: vi.fn(async () => undefined),
    updateProfile: vi.fn(async () => undefined),
    saveAvatar: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
  };
  return { repo, service: new OnboardingService({ repo, newObjectKey: () => "key-1" }) };
}

describe("OnboardingService.saveUserSettings", () => {
  it("slugifies the username and saves name and time zone", async () => {
    const { repo, service } = setup();
    expect(
      await service.saveUserSettings(1, { name: " Ada ", username: "Ada L", timeZone: "Europe/Paris" })
    ).toEqual({
      username: "ada-l",
    });
    expect(repo.updateUser).toHaveBeenCalledWith(1, {
      name: "Ada",
      username: "ada-l",
      timeZone: "Europe/Paris",
    });
  });

  it("refuses taken and reserved usernames and unknown time zones", async () => {
    const { repo, service } = setup(["ada"]);
    await expect(
      service.saveUserSettings(1, { name: "A", username: "ada", timeZone: "UTC" })
    ).rejects.toMatchObject({
      code: "username_already_taken",
    });
    await expect(
      service.saveUserSettings(1, { name: "A", username: "availability", timeZone: "UTC" })
    ).rejects.toMatchObject({ code: "username_already_taken" });
    await expect(
      service.saveUserSettings(1, { name: "A", username: "x", timeZone: "Mars/Base" })
    ).rejects.toMatchObject({ code: "invalid_timezone" });
    expect(repo.updateUser).not.toHaveBeenCalled();
  });
});

describe("OnboardingService.finish", () => {
  it("stores the avatar under a new key, the bio, and marks onboarding done", async () => {
    const { repo, service } = setup();
    await service.finish(1, { bio: "  Hi  ", avatar: PNG_DATA_URL });
    expect(repo.saveAvatar).toHaveBeenCalledWith(1, PNG_DATA_URL, "key-1");
    expect(repo.updateProfile).toHaveBeenCalledWith(1, { bio: "Hi", avatarUrl: "/api/avatar/key-1.png" });
    expect(repo.complete).toHaveBeenCalledWith(1);
  });

  it("keeps the current avatar when none is given, and rejects anything but images", async () => {
    const { repo, service } = setup();
    await service.finish(1, { bio: "", avatar: null });
    expect(repo.updateProfile).toHaveBeenCalledWith(1, { bio: null, avatarUrl: undefined });
    await expect(
      service.finish(1, { bio: "", avatar: "data:text/html;base64,PHNjcmlwdD4=" })
    ).rejects.toMatchObject({ code: "image_upload_error" });
  });
});

describe("decodeAvatar", () => {
  it("returns the image bytes and type", () => {
    const decoded = decodeAvatar(PNG_DATA_URL);
    expect(decoded?.contentType).toBe("image/png");
    expect([...(decoded?.body.slice(1, 4) ?? [])]).toEqual([0x50, 0x4e, 0x47]);
    expect(decodeAvatar("data:text/plain;base64,aGk=")).toBeNull();
  });
});

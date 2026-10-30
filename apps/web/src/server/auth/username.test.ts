import { describe, expect, it } from "vitest";
import type { UserRepository } from "../users/UserRepository";
import { findAvailableUsername, normalizeUsername, usernameFromEmail } from "./username";

function repoWithTaken(taken: string[]): Pick<UserRepository, "findTakenUsernamesWithoutOrganization"> {
  return {
    findTakenUsernamesWithoutOrganization: async (candidates: string[]) =>
      new Set(candidates.filter((candidate) => taken.includes(candidate))),
  };
}

describe("username helpers", () => {
  it("normalizes like Cal's slugify", () => {
    expect(normalizeUsername("  José Álvarez ")).toBe("jose-alvarez");
  });

  it("derives a username from the email's local part, falling back to 'user'", () => {
    expect(usernameFromEmail("Jane.Doe@example.com")).toBe("jane.doe");
    expect(usernameFromEmail("@example.com")).toBe("user");
  });

  it("keeps the base name when it is free", async () => {
    expect(await findAvailableUsername(repoWithTaken([]), "jane")).toBe("jane");
  });

  it("never picks a reserved route name", async () => {
    expect(await findAvailableUsername(repoWithTaken([]), "settings")).toMatch(/^settings-\d{4}$/);
  });

  it("adds a numeric suffix when the base name is taken", async () => {
    expect(await findAvailableUsername(repoWithTaken(["jane"]), "jane")).toMatch(/^jane-\d{4}$/);
  });
});

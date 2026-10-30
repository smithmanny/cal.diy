import { describe, expect, it } from "vitest";
import { bookerPath, teamSlugOf, teamTarget } from "./team-target";

describe("team targets", () => {
  it("round-trips a team slug and links to the team's booking page", () => {
    expect(teamSlugOf(teamTarget("sales"))).toBe("sales");
    expect(teamSlugOf("alice")).toBeNull();
    expect(bookerPath(teamTarget("sales"), "demo")).toBe("/team/sales/demo");
    expect(bookerPath("alice", "30min")).toBe("/alice/30min");
  });
});

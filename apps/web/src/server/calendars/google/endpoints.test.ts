import { describe, expect, it } from "vitest";
import { googleEndpoints } from "./endpoints";

const overrides = { GOOGLE_OAUTH_TOKEN_URL: "http://localhost:3298/token" };

describe("googleEndpoints", () => {
  it("lets development point OAuth at a fake", () => {
    expect(googleEndpoints(overrides, true).token).toBe("http://localhost:3298/token");
  });

  it("ignores overrides in production builds so tokens only ever go to Google", () => {
    expect(googleEndpoints(overrides, false).token).toBe("https://oauth2.googleapis.com/token");
  });
});

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  APPS,
  DYNAMIC_VIDEO_LOCATION_TYPES,
  findAppByLocationType,
  isValidAppLink,
  STATIC_LINK_LOCATION_TYPES,
} from "./apps";
import { LOCATION_LABEL_KEYS } from "./location-labels";

const APP_STORE = fileURLToPath(new URL("../../../../packages/app-store/", import.meta.url));

describe("app registry", () => {
  it("has unique slugs and credential types, and a logo in packages/app-store for each", () => {
    expect(new Set(APPS.map((app) => app.slug)).size).toBe(APPS.length);
    expect(new Set(APPS.map((app) => app.credentialType)).size).toBe(APPS.length);
    for (const app of APPS)
      expect(existsSync(`${APP_STORE}${app.dirName}/static/${app.logo}`), app.slug).toBe(true);
  });

  it("matches the location types event types accept", () => {
    const locationTypes = APPS.flatMap((app) => (app.locationType ? [app.locationType] : []));
    expect(locationTypes.sort()).toEqual(
      [...DYNAMIC_VIDEO_LOCATION_TYPES, ...STATIC_LINK_LOCATION_TYPES].sort()
    );
    for (const type of STATIC_LINK_LOCATION_TYPES)
      expect(findAppByLocationType(type)?.linkPattern).toBeTruthy();
    expect(LOCATION_LABEL_KEYS["integrations:zoom"]).toBe("Zoom Video");
  });

  it("checks room links against the app's pattern", () => {
    const whereby = findAppByLocationType("integrations:whereby_video");
    expect(whereby && isValidAppLink(whereby, "https://whereby.com/hana")).toBe(true);
    expect(whereby && isValidAppLink(whereby, "https://evil.test/whereby.com")).toBe(false);
    expect(isValidAppLink({ linkPattern: null }, "https://whereby.com/hana")).toBe(false);
  });
});

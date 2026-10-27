import "@tanstack/react-start/server-only";

import type { JsonValue } from "@calcom/db/ids";
import {
  APPS,
  type AppDefinition,
  type AppInstallFlow,
  appLogoUrl,
  findApp,
  isValidAppLink,
} from "~/lib/apps";
import type { CalendarService } from "../calendars/CalendarService";
import { AppError } from "../errors";
import { type EventLocation, eventLocationSchema } from "../event-types/types";
import { mergeMetadata, parseMetadata } from "../metadata";
import type { UserRepository } from "../users/UserRepository";
import type { VideoService } from "../video/VideoService";
import type { CredentialRepository } from "./CredentialRepository";

type Deps = {
  credentials: CredentialRepository;
  users: Pick<UserRepository, "findMetadata" | "updateMetadata">;
  calendars: CalendarService | null;
  video: VideoService | null;
};

function parseUrl(value: string | undefined): URL | null {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function defaultAppOf(metadata: unknown): ConferencingSettingsDto["defaultApp"] {
  const value = parseMetadata(metadata).defaultConferencingApp;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { appSlug, appLink } = value as { appSlug?: unknown; appLink?: unknown };
  if (typeof appSlug !== "string") return null;
  return { appSlug, appLink: typeof appLink === "string" ? appLink : null };
}

export type AppDto = {
  slug: string;
  dirName: string;
  name: string;
  logoUrl: string;
  category: AppDefinition["category"];
  install: AppInstallFlow;
  /** Whether this instance is set up for the app (its OAuth client or API key is configured). */
  available: boolean;
  credentialIds: number[];
};

export type ConferencingAppDto = {
  slug: string;
  name: string;
  logoUrl: string;
  locationType: string;
  /** Static-link apps: the room link must match this pattern. */
  linkPattern: string | null;
  credentialId: number | null;
};

export type ConferencingSettingsDto = {
  apps: ConferencingAppDto[];
  defaultApp: { appSlug: string; appLink: string | null } | null;
};

export type CalDavInput = { url?: string; username: string; password: string };

/** Lists, installs and removes apps, and keeps the user's default conferencing app (Cal's users.metadata). */
export class AppsService {
  constructor(private readonly deps: Deps) {}

  async listApps(userId: number): Promise<AppDto[]> {
    const rows = await this.deps.credentials.findByUserId(userId);
    return APPS.map((app) => ({
      slug: app.slug,
      dirName: app.dirName,
      name: app.name,
      logoUrl: appLogoUrl(app),
      category: app.category,
      install: app.install,
      available: this.isAvailable(app),
      credentialIds: rows.filter((row) => row.type === app.credentialType).map((row) => row.id),
    }));
  }

  /** Apps that need nothing but a click: Jitsi and the static-link apps. */
  async install(userId: number, slug: string): Promise<void> {
    const app = findApp(slug);
    if (!app || app.install !== "simple" || !this.isAvailable(app)) throw new AppError("not_found", 404);
    const existing = await this.deps.credentials.findByUserId(userId, [app.credentialType]);
    if (existing.length) return;
    await this.deps.credentials.create(userId, app.credentialType, null);
  }

  /** CalDAV servers and iCloud: the credentials are checked by listing calendars before they're kept. */
  async connectCalDav(userId: number, slug: string, input: CalDavInput): Promise<void> {
    const app = findApp(slug);
    if (!app || app.install !== "credentials" || !this.deps.calendars) throw new AppError("not_found", 404);
    const credentials = { username: input.username, password: input.password };
    if (app.slug === "apple-calendar") {
      await this.deps.calendars.connect(userId, app.credentialType, credentials);
      return;
    }
    const url = parseUrl(input.url);
    if (!url || (url.protocol !== "https:" && url.protocol !== "http:"))
      throw new AppError("invalid_url", 400);
    await this.deps.calendars.connect(userId, app.credentialType, { ...credentials, url: url.href });
  }

  async uninstall(userId: number, credentialId: number): Promise<void> {
    const row = await this.deps.credentials.findById(credentialId);
    const app = row && APPS.find((candidate) => candidate.credentialType === row.type);
    if (!row || row.userId !== userId || !app) throw new AppError("not_found", 404);
    if (app.category === "calendar" && this.deps.calendars)
      await this.deps.calendars.disconnect(userId, row.id);
    else await this.deps.credentials.delete(row.id);
    const metadata = await this.deps.users.findMetadata(userId);
    if (defaultAppOf(metadata)?.appSlug === app.slug)
      await this.deps.users.updateMetadata(userId, mergeMetadata(metadata, { defaultConferencingApp: null }));
  }

  /** Installed conferencing apps, plus Cal Video when the instance has it. */
  async conferencing(userId: number): Promise<ConferencingSettingsDto> {
    const [rows, metadata] = await Promise.all([
      this.deps.credentials.findByUserId(userId),
      this.deps.users.findMetadata(userId),
    ]);
    const apps = APPS.flatMap((app): ConferencingAppDto[] => {
      if (app.category !== "conferencing" || !app.locationType || !this.isAvailable(app)) return [];
      const row = rows.find((candidate) => candidate.type === app.credentialType);
      if (app.install !== "global" && !row) return [];
      return [
        {
          slug: app.slug,
          name: app.name,
          logoUrl: appLogoUrl(app),
          locationType: app.locationType,
          linkPattern: app.linkPattern ?? null,
          credentialId: row?.id ?? null,
        },
      ];
    });
    const defaultApp = defaultAppOf(metadata);
    return { apps, defaultApp: apps.some((app) => app.slug === defaultApp?.appSlug) ? defaultApp : null };
  }

  async setDefaultConferencingApp(userId: number, slug: string, link: string | null): Promise<void> {
    const app = (await this.conferencing(userId)).apps.find((candidate) => candidate.slug === slug);
    if (!app) throw new AppError("not_found", 404);
    if (app.linkPattern && (!link || !isValidAppLink(app, link))) throw new AppError("invalid_link", 400);
    const value: { [key: string]: JsonValue } = app.linkPattern
      ? { appSlug: slug, appLink: link }
      : { appSlug: slug };
    const metadata = await this.deps.users.findMetadata(userId);
    await this.deps.users.updateMetadata(userId, mergeMetadata(metadata, { defaultConferencingApp: value }));
  }

  /** The location new event types start with, like Cal: the default conferencing app, if any. */
  async defaultLocation(userId: number): Promise<EventLocation | null> {
    const { apps, defaultApp } = await this.conferencing(userId);
    const app = apps.find((candidate) => candidate.slug === defaultApp?.appSlug);
    if (!app || !defaultApp) return null;
    const parsed = eventLocationSchema.safeParse(
      app.linkPattern ? { type: app.locationType, link: defaultApp.appLink } : { type: app.locationType }
    );
    return parsed.success ? parsed.data : null;
  }

  private isAvailable(app: AppDefinition): boolean {
    switch (app.install) {
      case "oauth":
      case "credentials":
        return Boolean(
          this.deps.calendars?.hasProvider(app.credentialType) ||
            this.deps.video?.hasProvider(app.credentialType)
        );
      case "global":
        return Boolean(this.deps.video?.hasProvider(app.credentialType));
      default:
        // Static-link apps need nothing from the instance; Jitsi needs the meeting service.
        return !app.linkPattern ? Boolean(this.deps.video?.hasProvider(app.credentialType)) : true;
    }
  }
}

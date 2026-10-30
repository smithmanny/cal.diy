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
import type { TeamRepository } from "../teams/TeamRepository";
import { canManage } from "../teams/TeamService";
import type { UserRepository } from "../users/UserRepository";
import type { VideoService } from "../video/VideoService";
import type { CredentialOwner, CredentialRepository, CredentialRow } from "./CredentialRepository";

type Deps = {
  credentials: CredentialRepository;
  users: Pick<UserRepository, "findMetadata" | "updateMetadata">;
  teams: Pick<TeamRepository, "findManyForUser" | "findRole">;
  calendars: CalendarService | null;
  video: VideoService | null;
  /** Whether Stripe is configured, so hosts can connect it for paid events. */
  paymentsConfigured?: boolean;
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
  /** The user's own installs. */
  credentialIds: number[];
  /** Whether a team can install it for its event types (calendars stay personal, as in Cal). */
  teamInstallable: boolean;
  /** Installs on teams the user belongs to. */
  teamInstalls: { credentialId: number; teamId: number; teamName: string }[];
};

/** A team the user manages, which apps can be installed for. */
export type AppInstallTeamDto = { id: number; name: string };

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

function isTeamInstallable(app: AppDefinition): boolean {
  return app.category !== "calendar" && (app.install === "oauth" || app.install === "simple");
}

/** Lists, installs and removes apps, and keeps the user's default conferencing app (Cal's users.metadata). */
export class AppsService {
  constructor(private readonly deps: Deps) {}

  async listApps(userId: number): Promise<AppDto[]> {
    const teams = await this.deps.teams.findManyForUser(userId);
    const teamNames = new Map(teams.map((team) => [team.id, team.name]));
    const [rows, teamRows] = await Promise.all([
      this.deps.credentials.findByUserId(userId),
      this.deps.credentials.findByTeamIds([...teamNames.keys()]),
    ]);
    return APPS.map((app) => ({
      slug: app.slug,
      dirName: app.dirName,
      name: app.name,
      logoUrl: appLogoUrl(app),
      category: app.category,
      install: app.install,
      available: this.isAvailable(app),
      credentialIds: rows.filter((row) => row.type === app.credentialType).map((row) => row.id),
      teamInstallable: isTeamInstallable(app),
      teamInstalls: teamRows.flatMap(({ id, type, teamId }) =>
        type === app.credentialType && teamId !== null
          ? [{ credentialId: id, teamId, teamName: teamNames.get(teamId) ?? "" }]
          : []
      ),
    }));
  }

  async installTeams(userId: number): Promise<AppInstallTeamDto[]> {
    const teams = await this.deps.teams.findManyForUser(userId);
    return teams.filter((team) => canManage(team.role)).map(({ id, name }) => ({ id, name }));
  }

  /** Throws unless the user manages the team and the app (by Cal's folder name) can go on a team. */
  async assertTeamInstall(userId: number, teamId: number, dirName: string): Promise<void> {
    const app = APPS.find((candidate) => candidate.dirName === dirName);
    if (!app || !isTeamInstallable(app)) throw new AppError("not_found", 404);
    if (!canManage(await this.deps.teams.findRole(teamId, userId))) throw new AppError("not_found", 404);
  }

  /** Apps that need nothing but a click: Jitsi and the static-link apps, for the user or a team. */
  async install(userId: number, slug: string, teamId: number | null = null): Promise<void> {
    const app = findApp(slug);
    if (!app || app.install !== "simple" || !this.isAvailable(app)) throw new AppError("not_found", 404);
    if (teamId) await this.assertTeamInstall(userId, teamId, app.dirName);
    const owner: CredentialOwner = teamId ? { teamId } : { userId };
    const existing = teamId
      ? await this.deps.credentials.findByTeamId(teamId, [app.credentialType])
      : await this.deps.credentials.findByUserId(userId, [app.credentialType]);
    if (existing.length) return;
    await this.deps.credentials.create(owner, app.credentialType, null);
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
    if (!row || !app) throw new AppError("not_found", 404);
    if (row.teamId !== null) {
      if (!canManage(await this.deps.teams.findRole(row.teamId, userId)))
        throw new AppError("not_found", 404);
      await this.deps.credentials.delete(row.id);
      return;
    }
    if (row.userId !== userId) throw new AppError("not_found", 404);
    if (app.category === "calendar" && this.deps.calendars)
      await this.deps.calendars.disconnect(userId, row.id);
    else await this.deps.credentials.delete(row.id);
    const metadata = await this.deps.users.findMetadata(userId);
    if (defaultAppOf(metadata)?.appSlug === app.slug)
      await this.deps.users.updateMetadata(userId, mergeMetadata(metadata, { defaultConferencingApp: null }));
  }

  /**
   * Installed conferencing apps, plus Cal Video when the instance has it. For a team's event type,
   * the team's installs count too.
   */
  async conferencing(userId: number, teamId: number | null = null): Promise<ConferencingSettingsDto> {
    const [rows, metadata] = await Promise.all([
      this.installedFor(userId, teamId),
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

  private async installedFor(userId: number, teamId: number | null): Promise<CredentialRow[]> {
    const own = await this.deps.credentials.findByUserId(userId);
    if (!teamId || !(await this.deps.teams.findRole(teamId, userId))) return own;
    return [...own, ...(await this.deps.credentials.findByTeamId(teamId))];
  }

  private isAvailable(app: AppDefinition): boolean {
    if (app.category === "payment") return Boolean(this.deps.paymentsConfigured);
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

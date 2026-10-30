import "@tanstack/react-start/server-only";

import type { Database } from "@calcom/db/database";
import { CredentialRepository } from "../apps/CredentialRepository";
import { CredentialVault } from "../apps/CredentialVault";
import { dailyApiKey, encryptionKey, jitsiHost, publicUrl, teamsOAuth, zoomOAuth } from "../apps/config";
import { appEndpoints } from "../apps/endpoints";
import { getDb } from "../db";
import { dailyProvider, jitsiProvider, TEAMS_SCOPES, teamsProvider, zoomProvider } from "./providers";
import type { VideoProvider } from "./types";
import { VideoRepository } from "./VideoRepository";
import { VideoService } from "./VideoService";

/** Conferencing apps this instance can use; OAuth apps and Cal Video need their keys configured. */
export function videoProviders(): VideoProvider[] {
  const endpoints = appEndpoints();
  const zoom = zoomOAuth();
  const teams = teamsOAuth(TEAMS_SCOPES);
  const daily = dailyApiKey();
  return [
    ...(zoom ? [zoomProvider(zoom, endpoints.zoomApi)] : []),
    ...(teams ? [teamsProvider(teams, endpoints.microsoftGraph)] : []),
    ...(daily ? [dailyProvider(daily, endpoints.dailyApi, publicUrl())] : []),
    jitsiProvider(jitsiHost()),
  ];
}

/** Null without an encryption key, like calendar sync. */
export function createVideoService(db: Database): VideoService | null {
  const key = encryptionKey();
  if (!key) return null;
  return new VideoService(new VideoRepository(db), new CredentialRepository(db), {
    providers: videoProviders(),
    vault: new CredentialVault(key),
  });
}

export async function getVideoService(): Promise<VideoService | null> {
  return createVideoService(await getDb());
}

import { exchangeOAuthCode, type OAuthClientConfig, OAuthSession, type OAuthTokens } from "../apps/oauth";
import type { VideoClient, VideoMeetingInput, VideoProvider } from "./types";

const minutes = (input: VideoMeetingInput) =>
  Math.round((input.end.getTime() - input.start.getTime()) / 60_000);

/** Zoom's agenda is capped at 2000 characters. */
function zoomAgenda(description: string): string {
  const trimmed = description.trimEnd();
  return trimmed.length > 1900 ? `${trimmed.slice(0, 1900).trimEnd()}...` : trimmed;
}

class ZoomClient implements VideoClient {
  constructor(
    private readonly session: OAuthSession,
    private readonly apiUrl: string
  ) {}

  async createMeeting(input: VideoMeetingInput) {
    const created = await this.session.request<{ id: number; join_url: string; password?: string }>(
      `${this.apiUrl}/users/me/meetings`,
      { method: "POST", body: zoomMeetingBody(input) }
    );
    return { id: String(created.id), url: created.join_url, password: created.password || null };
  }

  async deleteMeeting(meetingId: string) {
    await this.session.request(
      `${this.apiUrl}/meetings/${encodeURIComponent(meetingId)}`,
      { method: "DELETE" },
      [404]
    );
  }
}

class TeamsClient implements VideoClient {
  constructor(
    private readonly session: OAuthSession,
    private readonly graphUrl: string
  ) {}

  async createMeeting(input: VideoMeetingInput) {
    const created = await this.session.request<{ id: string; joinWebUrl: string }>(
      `${this.graphUrl}/me/onlineMeetings`,
      {
        method: "POST",
        body: {
          startDateTime: input.start.toISOString(),
          endDateTime: input.end.toISOString(),
          subject: input.title,
        },
      }
    );
    return { id: created.id, url: created.joinWebUrl, password: null };
  }

  async deleteMeeting(meetingId: string) {
    await this.session.request(
      `${this.graphUrl}/me/onlineMeetings/${encodeURIComponent(meetingId)}`,
      { method: "DELETE" },
      [404]
    );
  }
}

/** Cal Video: a Daily room per booking, open until a day after it ends. */
class DailyClient implements VideoClient {
  constructor(
    private readonly apiKey: string,
    private readonly apiUrl: string,
    private readonly fetchImpl: typeof fetch
  ) {}

  async createMeeting(input: VideoMeetingInput) {
    const response = await this.fetchImpl(`${this.apiUrl}/rooms`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        privacy: "public",
        properties: {
          enable_prejoin_ui: true,
          enable_knocking: true,
          enable_screenshare: true,
          enable_chat: true,
          exp: Math.round(input.end.getTime() / 1000) + 86_400,
        },
      }),
    });
    if (!response.ok) throw new Error(`Daily room creation failed with ${response.status}`);
    const room = (await response.json()) as { name: string; url: string };
    return { id: room.name, url: room.url, password: null };
  }

  async deleteMeeting(meetingId: string) {
    const response = await this.fetchImpl(`${this.apiUrl}/rooms/${encodeURIComponent(meetingId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok && response.status !== 404)
      throw new Error(`Daily room deletion failed with ${response.status}`);
  }
}

/** Jitsi needs no API: any room name on the server is a meeting. */
class JitsiClient implements VideoClient {
  constructor(private readonly host: string) {}

  async createMeeting() {
    const id = crypto.randomUUID();
    return { id, url: `${this.host}/${id}`, password: null };
  }

  async deleteMeeting() {}
}

export function zoomMeetingBody(input: VideoMeetingInput) {
  return {
    topic: input.title,
    // A scheduled meeting.
    type: 2,
    start_time: `${input.start.toISOString().slice(0, 19)}Z`,
    duration: minutes(input),
    timezone: input.timeZone,
    agenda: zoomAgenda(input.description),
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: true,
      mute_upon_entry: false,
      approval_type: 2,
      audio: "both",
      auto_recording: "none",
      enforce_login: false,
      registrants_email_notification: true,
    },
  };
}

export const ZOOM_VIDEO_TYPE = "zoom_video";
export const TEAMS_VIDEO_TYPE = "office365_video";
export const DAILY_VIDEO_TYPE = "daily_video";
export const JITSI_VIDEO_TYPE = "jitsi_video";

export const TEAMS_SCOPES = ["OnlineMeetings.ReadWrite", "offline_access"];

export function zoomProvider(
  oauth: OAuthClientConfig,
  apiUrl: string,
  fetchImpl: typeof fetch = fetch
): VideoProvider {
  return {
    type: ZOOM_VIDEO_TYPE,
    locationType: "integrations:zoom",
    needsCredential: true,
    open: (key, onKeyChange) =>
      new ZoomClient(new OAuthSession(key as OAuthTokens, oauth, onKeyChange, fetchImpl), apiUrl),
    exchangeCode: (code) => exchangeOAuthCode(oauth, code, fetchImpl),
  };
}

export function teamsProvider(
  oauth: OAuthClientConfig,
  graphUrl: string,
  fetchImpl: typeof fetch = fetch
): VideoProvider {
  return {
    type: TEAMS_VIDEO_TYPE,
    locationType: "integrations:office365_video",
    needsCredential: true,
    open: (key, onKeyChange) =>
      new TeamsClient(new OAuthSession(key as OAuthTokens, oauth, onKeyChange, fetchImpl), graphUrl),
    exchangeCode: (code) => exchangeOAuthCode(oauth, code, fetchImpl),
  };
}

export function dailyProvider(
  apiKey: string,
  apiUrl: string,
  publicUrl: string,
  fetchImpl: typeof fetch = fetch
): VideoProvider {
  return {
    type: DAILY_VIDEO_TYPE,
    locationType: "integrations:daily",
    needsCredential: false,
    open: () => new DailyClient(apiKey, apiUrl, fetchImpl),
    publicLink: (bookingUid) => `${publicUrl}/video/${bookingUid}`,
  };
}

export function jitsiProvider(host: string): VideoProvider {
  return {
    type: JITSI_VIDEO_TYPE,
    locationType: "integrations:jitsi",
    needsCredential: true,
    open: () => new JitsiClient(host),
  };
}

/**
 * The apps Cal.diy can install, with the slugs, credential types and location types Cal uses, so
 * credentials, event type locations and booking references stay portable. Shared by the server and
 * the Apps pages; nothing here is secret.
 */

type AppCategory = "calendar" | "conferencing";

/**
 * How an app is added: through the provider's OAuth consent screen, a form for server credentials
 * (CalDAV), a single click (apps that need nothing but a room link on each event type), or not at
 * all (Cal Video, which the instance enables for everyone).
 */
type AppInstallFlow = "oauth" | "credentials" | "simple" | "global";

type AppDefinition = {
  slug: string;
  /** Folder in packages/app-store, which also names Cal's OAuth callback route. */
  dirName: string;
  name: string;
  logo: string;
  category: AppCategory;
  /** Credential.type and BookingReference.type. */
  credentialType: string;
  install: AppInstallFlow;
  /** EventType.locations[].type for conferencing apps. */
  locationType?: string;
  /** For apps whose meeting is a fixed room link the host enters: what that link must look like. */
  linkPattern?: string;
};

// slug (also the app-store folder), name, credential type, logo, location type, link pattern; from
// each app's config.json in packages/app-store.
const STATIC_LINK_ROWS = [
  [
    "campfire",
    "Campfire",
    "campfire_video",
    "icon.svg",
    "integrations:campfire_video",
    "^http(s)?:\\/\\/(www\\.)?party.campfire.to\\/[a-zA-Z0-9]*",
  ],
  [
    "demodesk",
    "Demodesk",
    "demodesk_conferencing",
    "icon.svg",
    "integrations:demodesk_video",
    "^http(s)?:\\/\\/(www\\.)?demodesk.com\\/[a-zA-Z0-9]*",
  ],
  [
    "dialpad",
    "Dialpad",
    "dialpad_conferencing",
    "icon.svg",
    "integrations:dialpad_video",
    "^https:\\/\\/meetings\\.dialpad\\.com\\/[a-zA-Z0-9._-]+$",
  ],
  [
    "discord",
    "Discord",
    "discord_video",
    "icon.svg",
    "integrations:discord_video",
    "^http(s)?:\\/\\/(www\\.)?discord\\.(gg|com)\\/[a-zA-Z0-9]+",
  ],
  [
    "eightxeight",
    "8x8",
    "eightxeight_video",
    "icon.svg",
    "integrations:eightxeight_video",
    "^(http|https)://(www\\.)?8x8.vc/[a-zA-Z0-9]*",
  ],
  [
    "element-call",
    "Element Call",
    "element-call_conferencing",
    "icon.svg",
    "integrations:element-call_video",
    "^http(s)?:\\/\\/(www\\.)?call.element.io/[a-zA-Z0-9]*",
  ],
  [
    "facetime",
    "FaceTime",
    "facetime_video",
    "icon.svg",
    "integrations:facetime_video",
    "^https?:\\/\\/facetime\\.apple\\.com\\/join.+$",
  ],
  [
    "horizon-workrooms",
    "Horizon Workrooms",
    "horizon-workrooms_conferencing",
    "icon.svg",
    "integrations:horizon-workrooms_video",
    "^http(s)?:\\/\\/(www\\.)?workrooms.workplace.com\\/[a-zA-Z0-9]*",
  ],
  [
    "mirotalk",
    "MiroTalk",
    "mirotalk_video",
    "icon.svg",
    "integrations:mirotalk_video",
    "^(http|https):\\/\\/(p2p|sfu)\\.mirotalk\\.com\\/join\\/[a-zA-Z0-9._-]+$",
  ],
  [
    "ping",
    "Ping.gg",
    "ping_video",
    "icon.svg",
    "integrations:ping_video",
    "^http(s)?:\\/\\/(www\\.)?ping.gg\\/call\\/[a-zA-Z0-9]*",
  ],
  [
    "riverside",
    "Riverside",
    "riverside_video",
    "icon-dark.svg",
    "integrations:riverside_video",
    "^https?:\\/\\/(www\\.)?riverside\\.(fm|com)\\/studio\\/.+",
  ],
  [
    "roam",
    "Roam",
    "roam_conferencing",
    "icon.png",
    "integrations:roam_video",
    "^http(s)?:\\/\\/(www\\.)?ro.am\\/[a-zA-Z0-9]*",
  ],
  [
    "salesroom",
    "Salesroom",
    "salesroom_conferencing",
    "icon.svg",
    "integrations:salesroom_video",
    "^https:\\/\\/.+\\.sr\\.chat",
  ],
  [
    "signal",
    "Signal",
    "signal_video",
    "icon.svg",
    "integrations:signal_video",
    "^http(s)?:\\/\\/(www\\.)?signal.me\\/[a-zA-Z0-9]*",
  ],
  [
    "sirius_video",
    "Sirius Video",
    "sirius_video_video",
    "icon-dark.svg",
    "integrations:sirius_video_video",
    "^http(s)?:\\/\\/(www\\.)?sirius.video\\/[a-zA-Z0-9]*",
  ],
  [
    "skype",
    "Skype",
    "skype_conferencing",
    "icon.svg",
    "integrations:skype_video",
    "https://join\\.skype\\.com/[a-zA-Z0-9]*",
  ],
  [
    "telegram",
    "Telegram",
    "telegram_video",
    "icon.svg",
    "integrations:telegram_video",
    "^http(s)?:\\/\\/(www\\.)?t.me\\/[a-zA-Z0-9]*",
  ],
  [
    "whatsapp",
    "WhatsApp",
    "whatsapp_video",
    "icon.svg",
    "integrations:whatsapp_video",
    "^http(s)?:\\/\\/(www\\.)?wa.me\\/[a-zA-Z0-9]*",
  ],
  [
    "whereby",
    "Whereby",
    "whereby_video",
    "icon-dark.svg",
    "integrations:whereby_video",
    "^(?:https?://)?(?:(?!.*-\\.)(?:\\w+(-\\w+)*\\.))*whereby\\.com(/[\\w\\-._~:?#\\[\\]@!$&'()*+,;%=]+)*$",
  ],
] as const;

type StaticLinkLocationType = (typeof STATIC_LINK_ROWS)[number][4];

const STATIC_LINK_APPS = STATIC_LINK_ROWS.map(
  ([slug, name, credentialType, logo, locationType, linkPattern]): AppDefinition => ({
    slug,
    dirName: slug,
    name,
    logo,
    category: "conferencing",
    credentialType,
    install: "simple",
    locationType,
    linkPattern,
  })
);

/** Conferencing apps that create a meeting for each booking. */
export const DYNAMIC_VIDEO_LOCATION_TYPES = [
  "integrations:zoom",
  "integrations:office365_video",
  "integrations:daily",
  "integrations:jitsi",
] as const;

/** Conferencing apps whose meeting is the host's own room link, kept on the event type location. */
export const STATIC_LINK_LOCATION_TYPES = STATIC_LINK_ROWS.map((row) => row[4]) as [
  StaticLinkLocationType,
  ...StaticLinkLocationType[],
];

export const APPS: AppDefinition[] = [
  {
    slug: "google-calendar",
    dirName: "googlecalendar",
    name: "Google Calendar",
    logo: "icon.svg",
    category: "calendar",
    credentialType: "google_calendar",
    install: "oauth",
  },
  {
    slug: "office365-calendar",
    dirName: "office365calendar",
    name: "Outlook Calendar",
    logo: "icon.svg",
    category: "calendar",
    credentialType: "office365_calendar",
    install: "oauth",
  },
  {
    slug: "apple-calendar",
    dirName: "applecalendar",
    name: "Apple Calendar",
    logo: "icon.svg",
    category: "calendar",
    credentialType: "apple_calendar",
    install: "credentials",
  },
  {
    slug: "caldav-calendar",
    dirName: "caldavcalendar",
    name: "CalDAV",
    logo: "icon.svg",
    category: "calendar",
    credentialType: "caldav_calendar",
    install: "credentials",
  },
  {
    slug: "daily-video",
    dirName: "dailyvideo",
    name: "Cal Video",
    logo: "icon.svg",
    category: "conferencing",
    credentialType: "daily_video",
    install: "global",
    locationType: "integrations:daily",
  },
  {
    slug: "zoom",
    dirName: "zoomvideo",
    name: "Zoom Video",
    logo: "icon.svg",
    category: "conferencing",
    credentialType: "zoom_video",
    install: "oauth",
    locationType: "integrations:zoom",
  },
  {
    slug: "msteams",
    dirName: "office365video",
    name: "Microsoft Teams",
    logo: "icon.svg",
    category: "conferencing",
    credentialType: "office365_video",
    install: "oauth",
    locationType: "integrations:office365_video",
  },
  {
    slug: "jitsi",
    dirName: "jitsivideo",
    name: "Jitsi Meet",
    logo: "icon.svg",
    category: "conferencing",
    credentialType: "jitsi_video",
    install: "simple",
    locationType: "integrations:jitsi",
  },
  ...STATIC_LINK_APPS,
];

export type { AppCategory, AppDefinition, AppInstallFlow };

export function findApp(slug: string): AppDefinition | undefined {
  return APPS.find((app) => app.slug === slug);
}

export function findAppByLocationType(type: string): AppDefinition | undefined {
  return APPS.find((app) => app.locationType === type);
}

/** Copied from packages/app-store at build time (scripts/copy-app-logos.ts). */
export function appLogoUrl(app: Pick<AppDefinition, "dirName" | "logo">): string {
  return `/app-store/${app.dirName}/${app.logo}`;
}

export function isValidAppLink(app: { linkPattern?: string | null }, link: string): boolean {
  if (!app.linkPattern) return false;
  try {
    return new RegExp(app.linkPattern).test(link);
  } catch {
    return false;
  }
}

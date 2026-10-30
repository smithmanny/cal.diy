import { ClockIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PoweredBy } from "~/components/PoweredBy";
import { ThemeScope } from "~/components/ThemeScope";
import { useT } from "~/lib/i18n";
import type { getPublicProfile } from "~/server/bookings/functions";

type Profile = Awaited<ReturnType<typeof getPublicProfile>>;
type ListedEventType = Profile["eventTypes"][number];

export const PUBLIC_PROFILE_MESSAGE_KEYS = ["minutes", "no_event_types_have_been_setup", "powered_by"];

/** A user's, group's or team's public page: who they are and the event types to book. */
export function PublicProfile({
  profile,
  eventLink,
}: {
  profile: Profile;
  /** Wraps an event type's row in a link to its booking page. */
  eventLink: (eventType: ListedEventType, children: ReactNode) => ReactNode;
}) {
  const t = useT();
  const bio = "bio" in profile ? profile.bio : null;
  return (
    <ThemeScope
      theme={profile.host.appearance.theme}
      brandColor={profile.host.appearance.brandColor}
      darkBrandColor={profile.host.appearance.darkBrandColor}>
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
        <header className="flex flex-col items-center gap-2 text-center">
          {profile.host.avatarUrl && (
            <img src={profile.host.avatarUrl} alt="" className="size-20 rounded-full object-cover" />
          )}
          <h1 className="font-heading text-2xl">{profile.host.name ?? profile.host.username}</h1>
          {bio && <p className="whitespace-pre-line text-muted-foreground text-sm">{bio}</p>}
        </header>
        {profile.eventTypes.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm">{t("no_event_types_have_been_setup")}</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {profile.eventTypes.map((eventType) => (
              <li key={eventType.slug}>
                {eventLink(
                  eventType,
                  <>
                    <span className="font-medium">{eventType.title}</span>
                    {eventType.description && (
                      <span className="text-muted-foreground text-sm">{eventType.description}</span>
                    )}
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      <ClockIcon className="size-3" />
                      {eventType.length} {t("minutes")}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <PoweredBy hidden={profile.host.appearance.hideBranding} t={t} />
      </main>
    </ThemeScope>
  );
}

export const PROFILE_LINK_CLASS = "flex flex-col gap-1 p-4 transition-colors hover:bg-accent/50";

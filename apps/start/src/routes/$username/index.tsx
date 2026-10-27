import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ClockIcon } from "lucide-react";
import { PoweredBy } from "~/components/PoweredBy";
import { ThemeScope } from "~/components/ThemeScope";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { NOINDEX_META } from "~/lib/seo";
import { getPublicProfile } from "~/server/bookings/functions";

const MESSAGE_KEYS = ["minutes", "no_event_types_have_been_setup", "powered_by"];

function ProfilePage() {
  const { profile } = Route.useLoaderData();
  const t = useT();
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
          {profile.bio && <p className="whitespace-pre-line text-muted-foreground text-sm">{profile.bio}</p>}
        </header>
        {profile.eventTypes.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm">{t("no_event_types_have_been_setup")}</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {profile.eventTypes.map((eventType) => (
              <li key={eventType.slug}>
                <Link
                  to="/$username/$slug"
                  params={{ username: profile.host.username, slug: eventType.slug }}
                  className="flex flex-col gap-1 p-4 transition-colors hover:bg-accent/50">
                  <span className="font-medium">{eventType.title}</span>
                  {eventType.description && (
                    <span className="text-muted-foreground text-sm">{eventType.description}</span>
                  )}
                  <span className="flex items-center gap-1 text-muted-foreground text-xs">
                    <ClockIcon className="size-3" />
                    {eventType.length} {t("minutes")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <PoweredBy hidden={profile.host.appearance.hideBranding} t={t} />
      </main>
    </ThemeScope>
  );
}

export const Route = createFileRoute("/$username/")({
  loader: async ({ context, params }) => {
    const [messages, profile] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getPublicProfile({ data: { username: params.username } }).catch(() => {
        throw notFound();
      }),
    ]);
    return { messages, profile };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.profile.host.name ?? "Cal.diy" },
      ...(loaderData && !loaderData.profile.host.allowSEOIndexing ? [NOINDEX_META] : []),
    ],
  }),
  component: ProfilePage,
});

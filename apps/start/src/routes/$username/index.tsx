import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PROFILE_LINK_CLASS, PUBLIC_PROFILE_MESSAGE_KEYS, PublicProfile } from "~/components/PublicProfile";
import { loadMessages } from "~/lib/messages";
import { NOINDEX_META } from "~/lib/seo";
import { getPublicProfile } from "~/server/bookings/functions";

function ProfilePage() {
  const { profile } = Route.useLoaderData();
  return (
    <PublicProfile
      profile={profile}
      eventLink={(eventType, children) => (
        <Link
          to="/$username/$slug"
          params={{ username: profile.host.username, slug: eventType.slug }}
          className={PROFILE_LINK_CLASS}>
          {children}
        </Link>
      )}
    />
  );
}

export const Route = createFileRoute("/$username/")({
  loader: async ({ context, params }) => {
    const [messages, profile] = await Promise.all([
      loadMessages(context, PUBLIC_PROFILE_MESSAGE_KEYS),
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

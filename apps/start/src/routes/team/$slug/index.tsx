import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PROFILE_LINK_CLASS, PUBLIC_PROFILE_MESSAGE_KEYS, PublicProfile } from "~/components/PublicProfile";
import { loadMessages } from "~/lib/messages";
import { teamTarget } from "~/lib/team-target";
import { getPublicProfile } from "~/server/bookings/functions";

function TeamProfilePage() {
  const { profile } = Route.useLoaderData();
  const { slug } = Route.useParams();
  return (
    <PublicProfile
      profile={profile}
      eventLink={(eventType, children) => (
        <Link to="/team/$slug/$type" params={{ slug, type: eventType.slug }} className={PROFILE_LINK_CLASS}>
          {children}
        </Link>
      )}
    />
  );
}

export const Route = createFileRoute("/team/$slug/")({
  loader: async ({ context, params }) => {
    const [messages, profile] = await Promise.all([
      loadMessages(context, PUBLIC_PROFILE_MESSAGE_KEYS),
      getPublicProfile({ data: { username: teamTarget(params.slug) } }).catch(() => {
        throw notFound();
      }),
    ]);
    return { messages, profile };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.profile.host.name ?? "Cal.diy" }] }),
  component: TeamProfilePage,
});

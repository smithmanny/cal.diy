import { createFileRoute, notFound } from "@tanstack/react-router";
import { BOOKER_MESSAGE_KEYS, BookerPage } from "~/components/booker/BookerPage";
import { loadMessages } from "~/lib/messages";
import { teamTarget } from "~/lib/team-target";
import { getPublicEvent } from "~/server/bookings/functions";

function TeamEventPage() {
  const { event, locale, rescheduleUid } = Route.useLoaderData();
  const { slug, type } = Route.useParams();
  const { layout } = Route.useSearch();
  return (
    <BookerPage
      event={event}
      locale={locale}
      username={teamTarget(slug)}
      slug={type}
      rescheduleUid={rescheduleUid}
      requestedLayout={layout}
    />
  );
}

export const Route = createFileRoute("/team/$slug/$type")({
  validateSearch: (search: Record<string, unknown>): { rescheduleUid?: string; layout?: string } => ({
    rescheduleUid: typeof search.rescheduleUid === "string" ? search.rescheduleUid : undefined,
    layout: typeof search.layout === "string" ? search.layout : undefined,
  }),
  loaderDeps: ({ search }) => ({ rescheduleUid: search.rescheduleUid }),
  loader: async ({ context, params, deps }) => {
    const event = await getPublicEvent({
      data: { username: teamTarget(params.slug), slug: params.type },
    }).catch(() => {
      throw notFound();
    });
    const locale = event.eventType.interfaceLanguage ?? context.locale;
    const messages = await loadMessages({ locale }, BOOKER_MESSAGE_KEYS);
    return { messages, event, locale, rescheduleUid: deps.rescheduleUid };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.event.eventType.title} | ${loaderData.event.host.name ?? ""}`
          : "Cal.diy",
      },
    ],
  }),
  component: TeamEventPage,
});

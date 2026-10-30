import { createFileRoute, notFound } from "@tanstack/react-router";
import { BOOKER_MESSAGE_KEYS, BookerPage } from "~/components/booker/BookerPage";
import { loadMessages } from "~/lib/messages";
import { NOINDEX_META } from "~/lib/seo";
import { getPublicEvent } from "~/server/bookings/functions";

function UserEventPage() {
  const { event, locale, rescheduleUid } = Route.useLoaderData();
  const { username, slug } = Route.useParams();
  const { layout } = Route.useSearch();
  return (
    <BookerPage
      event={event}
      locale={locale}
      username={username}
      slug={slug}
      rescheduleUid={rescheduleUid}
      requestedLayout={layout}
    />
  );
}

export const Route = createFileRoute("/$username/$slug")({
  validateSearch: (search: Record<string, unknown>): { rescheduleUid?: string; layout?: string } => ({
    rescheduleUid: typeof search.rescheduleUid === "string" ? search.rescheduleUid : undefined,
    layout: typeof search.layout === "string" ? search.layout : undefined,
  }),
  loaderDeps: ({ search }) => ({ rescheduleUid: search.rescheduleUid }),
  loader: async ({ context, params, deps }) => {
    const event = await getPublicEvent({ data: params }).catch(() => {
      throw notFound();
    });
    // A host can pin the booking page's language; otherwise it follows the visitor.
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
      ...(loaderData && !loaderData.event.host.allowSEOIndexing ? [NOINDEX_META] : []),
    ],
  }),
  component: UserEventPage,
});

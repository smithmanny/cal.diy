import { createFileRoute, notFound } from "@tanstack/react-router";
import { BOOKER_MESSAGE_KEYS, BookerPage } from "~/components/booker/BookerPage";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { NOINDEX_META } from "~/lib/seo";
import { getPublicEvent, resolvePrivateLink } from "~/server/bookings/functions";

function PrivateLinkPage() {
  const data = Route.useLoaderData();
  const t = useT();
  const { link, slug } = Route.useParams();
  if (!data.event)
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <p className="rounded-xl border bg-background p-8 text-center">{t("private_link_expired")}</p>
      </main>
    );
  return (
    <BookerPage
      event={data.event}
      locale={data.locale}
      username={data.username}
      slug={slug}
      hashedLink={link}
    />
  );
}

// Cal's private links: the event without the host's username in the URL, until the link expires.
export const Route = createFileRoute("/d/$link/$slug")({
  loader: async ({ context, params }) => {
    const target = await resolvePrivateLink({ data: params }).catch(() => null);
    if (!target) {
      const messages = await loadMessages(context, ["private_link_expired"]);
      return { messages, event: null, locale: context.locale, username: "" };
    }
    const event = await getPublicEvent({ data: target }).catch(() => {
      throw notFound();
    });
    const locale = event.eventType.interfaceLanguage ?? context.locale;
    const messages = await loadMessages({ locale }, BOOKER_MESSAGE_KEYS);
    return { messages, event, locale, username: target.username };
  },
  // Private links are for the people they're shared with, never for search engines.
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.event?.eventType.title ?? "Cal.diy" }, NOINDEX_META],
  }),
  component: PrivateLinkPage,
});

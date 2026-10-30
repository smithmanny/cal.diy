import { Button } from "@coss/ui/components/button";
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { EmbedProvider } from "~/components/embed/EmbedProvider";
import { DEFAULT_LOCALE, localeDirection } from "~/lib/locales";
import { getRequestContext, type RequestContext } from "~/server/auth/session";
import stylesUrl from "~/styles.css?url";

// The shell wraps every render, including error and not-found states, so those still get <html>/<body>.
function RootDocument({ children }: { children: ReactNode }) {
  // Missing when the root beforeLoad itself failed.
  const locale = Route.useRouteContext()?.locale ?? DEFAULT_LOCALE;
  return (
    <html lang={locale} dir={localeDirection(locale)}>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <EmbedProvider>{children}</EmbedProvider>
        <Scripts />
      </body>
    </html>
  );
}

// Rendered when even the root request context failed (e.g. the server is unreachable), so no
// translations could be loaded; plain English is the only option here.
function RootError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-heading text-xl">Something went wrong.</h1>
      {/* Raw messages can include server internals (SQL, config), so only show them in development. */}
      {import.meta.env.DEV && error instanceof Error && (
        <p className="max-w-md text-muted-foreground text-sm">{error.message}</p>
      )}
      <Button onClick={() => router.invalidate()}>Try again</Button>
    </main>
  );
}

export const Route = createRootRouteWithContext<RequestContext>()({
  beforeLoad: () => getRequestContext(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cal.diy" },
    ],
    links: [
      { rel: "stylesheet", href: stylesUrl },
      {
        rel: "preload",
        href: "/fonts/Inter-roman.var.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  shellComponent: RootDocument,
  errorComponent: RootError,
  component: Outlet,
});

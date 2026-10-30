import { Button } from "@coss/ui/components/button";
import { Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createT, type Messages } from "~/lib/i18n";
import { DEFAULT_LOCALE } from "~/lib/locales";
import { getMessages } from "~/server/i18n";

const MESSAGE_KEYS = ["error_404", "page_doesnt_exist", "go_back_home"];

// Shown on the first render, before the reader's language loads (not-found routes have no loader).
const ENGLISH: Messages = {
  error_404: "Error 404",
  page_doesnt_exist: "This page does not exist.",
  go_back_home: "Go back home",
};

/** The app-wide 404, for unknown paths and pages whose loader found nothing. */
export function NotFound() {
  // Not-found renders can happen before or outside a match, so the root context may be missing.
  const locale = useRouteContext({ strict: false })?.locale ?? DEFAULT_LOCALE;
  const [messages, setMessages] = useState<Messages>(ENGLISH);
  useEffect(() => {
    if (locale === "en") return;
    getMessages({ data: { locale, keys: MESSAGE_KEYS } })
      .then(setMessages)
      .catch(() => undefined);
  }, [locale]);
  const t = createT(messages, locale);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-medium text-muted-foreground text-sm">{t("error_404")}</p>
      <h1 className="font-heading text-2xl">{t("page_doesnt_exist")}</h1>
      <Button variant="outline" render={<Link to="/" />}>
        {t("go_back_home")}
      </Button>
    </main>
  );
}

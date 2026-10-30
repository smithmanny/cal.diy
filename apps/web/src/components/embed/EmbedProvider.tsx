import { useLocation } from "@tanstack/react-router";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  connectedSearch,
  embedEventMessage,
  embedNamespace,
  embedTheme,
  parseParentCommand,
} from "~/lib/embed";
import type { ThemePreference } from "~/lib/theme";

type EmbedState = {
  /** Set when embed.js loaded this page in its iframe. */
  embedded: boolean;
  /** The embedding site's theme (`ui` or `?theme=`), which wins over the host's; undefined when unset. */
  theme: ThemePreference | undefined;
  /** Sends an event to the embedding site, as Cal's sdkActionManager.fire does. */
  fire: (type: string, data: unknown) => void;
};

const EmbedContext = createContext<EmbedState>({ embedded: false, theme: undefined, fire: () => undefined });

function postToParent(namespace: string, type: string, data: unknown) {
  // embed.js runs on any site, so the target origin can't be narrowed; nothing private is sent.
  window.parent.postMessage(embedEventMessage(namespace, type, data), "*");
}

/** Reports the content's size, so embed.js can grow the iframe instead of scrolling inside it. */
function observeDimensions(namespace: string): () => void {
  let isFirstTime = true;
  let lastHeight = -1;
  const measure = () => {
    const { height, width } = document.body.getBoundingClientRect();
    const iframeHeight = Math.ceil(height);
    if (iframeHeight === lastHeight) return;
    lastHeight = iframeHeight;
    postToParent(namespace, "__dimensionChanged", {
      iframeHeight,
      iframeWidth: Math.ceil(width),
      isFirstTime,
    });
    isFirstTime = false;
  };
  const observer = new ResizeObserver(measure);
  observer.observe(document.body);
  measure();
  return () => observer.disconnect();
}

function useParentCommands(namespace: string | null, setTheme: (theme: ThemePreference) => void) {
  useEffect(() => {
    if (namespace === null) return;
    document.documentElement.dataset.embed = "";
    const isPrerendering = new URLSearchParams(window.location.search).get("prerender") === "true";
    let linkReadySent = false;
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || namespace === null) return;
      const command = parseParentCommand(event.data);
      if (!command) return;
      if (command.method === "parentKnowsIframeReady") {
        if (linkReadySent || isPrerendering) return;
        linkReadySent = true;
        postToParent(namespace, "linkReady", {});
      } else if (command.method === "ui") {
        const theme = embedTheme(command.arg.theme);
        if (theme !== undefined) setTheme(theme);
      } else {
        window.location.search = connectedSearch(window.location.search, command.arg);
      }
    }
    window.addEventListener("message", onMessage);
    postToParent(namespace, "__iframeReady", { isPrerendering });
    const stopObserving = observeDimensions(namespace);
    return () => {
      window.removeEventListener("message", onMessage);
      stopObserving();
    };
  }, [namespace, setTheme]);
}

/**
 * Speaks Cal's embed protocol (see ~/lib/embed) when embed.js loads a page in its iframe. The
 * namespace comes from `?embed=` on the first page, then from the iframe's name after navigation.
 */
export function EmbedProvider({ children }: { children: ReactNode }) {
  const search = useLocation({ select: (location) => location.search as Record<string, unknown> });
  // The router parses query values as JSON, so `?embed=1` arrives as a number.
  const [namespace, setNamespace] = useState<string | null>(() =>
    search.embed === undefined || search.embed === null ? null : String(search.embed)
  );
  const [theme, setThemeState] = useState<ThemePreference | undefined>(() =>
    embedTheme(typeof search.theme === "string" ? search.theme : undefined)
  );
  const setTheme = useCallback((next: ThemePreference) => setThemeState(next), []);

  useEffect(() => {
    if (window.parent === window) return;
    setNamespace((current) => current ?? embedNamespace(window.location.search, window.name));
  }, []);
  useParentCommands(namespace, setTheme);

  const value = useMemo<EmbedState>(
    () => ({
      embedded: namespace !== null,
      theme,
      fire: (type, data) => {
        if (namespace !== null) postToParent(namespace, type, data);
      },
    }),
    [namespace, theme]
  );
  return <EmbedContext.Provider value={value}>{children}</EmbedContext.Provider>;
}

export function useEmbed(): EmbedState {
  return useContext(EmbedContext);
}

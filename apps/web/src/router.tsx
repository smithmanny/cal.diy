import { createRouter } from "@tanstack/react-router";
import { NotFound } from "./components/NotFound";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    // Filled in by the root route's beforeLoad (session + locale).
    context: { user: null, locale: "en", origin: "" },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultNotFoundComponent: NotFound,
  });
}

import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    // Filled in by the root route's beforeLoad (session + locale).
    context: { user: null, locale: "en" },
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}

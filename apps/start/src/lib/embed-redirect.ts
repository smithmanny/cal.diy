import { type ParsedLocation, redirect } from "@tanstack/react-router";

/**
 * embed.js loads `<page>/embed`. Pages here render embedded themselves (see EmbedProvider), so the
 * embed path sends the iframe to the page, keeping the query that carries the namespace and prefill.
 */
export function redirectOutOfEmbedPath(location: ParsedLocation): never {
  const pagePath = location.pathname.replace(/\/embed\/?$/, "") || "/";
  throw redirect({ href: `${pagePath}${location.searchStr}`, statusCode: 302 });
}

/**
 * Just enough WebDAV multistatus parsing for CalDAV, without a DOM (Workers have no DOMParser).
 * Namespace prefixes are dropped, since servers pick their own (d:, D:, none, …).
 */

type DavResponse = { href: string; props: string };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function stripPrefixes(xml: string): string {
  return xml.replace(/<(\/?)[A-Za-z][\w.-]*:/g, "<$1");
}

export function decodeXmlText(text: string): string {
  const cdata = text.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1];
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X"))
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number(entity.slice(1)));
    return ENTITIES[entity] ?? match;
  });
}

/** The inner XML of the first `name` element, "" for an empty one, or null when absent. */
export function element(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${name}>)`));
  if (!match) return null;
  return match[1] ?? "";
}

/** Each response's href and the props of its successful propstats. */
export function parseMultistatus(xml: string): DavResponse[] {
  const plain = stripPrefixes(xml);
  const responses: DavResponse[] = [];
  for (const [, body] of plain.matchAll(/<response(?:\s[^>]*)?>([\s\S]*?)<\/response>/g)) {
    const href = decodeXmlText(element(body, "href")?.trim() ?? "");
    const props = [...body.matchAll(/<propstat(?:\s[^>]*)?>([\s\S]*?)<\/propstat>/g)]
      .filter(([, propstat]) => /\s2\d\d\s/.test(element(propstat, "status") ?? " 200 "))
      .map(([, propstat]) => element(propstat, "prop") ?? "")
      .join("");
    responses.push({ href, props });
  }
  return responses;
}

/** The href inside a property like current-user-principal or calendar-home-set. */
export function hrefProp(props: string, name: string): string | null {
  const value = element(props, name);
  const href = value === null ? null : element(value, "href");
  return href ? decodeXmlText(href.trim()) : null;
}

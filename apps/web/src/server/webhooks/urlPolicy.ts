import process from "node:process";

/**
 * Webhooks are POSTed by this server, so a URL on its own network would let any user reach
 * services that aren't meant to be public (and read their status codes through the ping test).
 * Self-hosters who post to something on the same machine, like n8n, opt in with this setting.
 */
export function privateWebhookUrlsAllowed(): boolean {
  return process.env.ALLOW_PRIVATE_WEBHOOK_URLS === "true";
}

function ipv4Parts(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) return null;
  const numbers = parts.map(Number);
  return numbers.every((part) => part <= 255) ? numbers : null;
}

function isPrivateIpv4([a, b]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** An IPv4 address carried in an IPv6 one (::ffff:7f00:1 is 127.0.0.1), as the URL parser writes it. */
function mappedIpv4(host: string): number[] | null {
  const match = /^::ffff:(?:([\d.]+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(host);
  if (!match) return null;
  if (match[1]) return ipv4Parts(match[1]);
  const [high, low] = [Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)];
  return [high >> 8, high & 255, low >> 8, low & 255];
}

function isPrivateIpv6(host: string): boolean {
  const mapped = mappedIpv4(host);
  if (mapped) return isPrivateIpv4(mapped);
  return host === "::" || host === "::1" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || /^ff/.test(host);
}

/**
 * Loopback, private, link-local (including cloud metadata at 169.254.169.254) and other
 * non-public addresses, plus names that only resolve inside a network. A public name that
 * resolves to a private address isn't caught; that needs a DNS lookup the Workers runtime lacks.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  const ipv4 = ipv4Parts(host);
  if (ipv4) return isPrivateIpv4(ipv4);
  if (host.includes(":")) return isPrivateIpv6(host);
  if (!host.includes(".")) return true;
  return [".localhost", ".local", ".internal", ".home.arpa", ".lan"].some((suffix) => host.endsWith(suffix));
}

/** Whether this server may POST to the URL. */
export function isAllowedWebhookUrl(url: string, allowPrivate = privateWebhookUrlsAllowed()): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  return allowPrivate || !isPrivateHost(parsed.hostname);
}

/**
 * Guards for partner-supplied webhook URLs, so deliveries cannot be pointed
 * at hosts inside our own network (server-side request forgery).
 */

function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (!v6.includes(":")) return false;
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return (
    v6 === "::" || v6 === "::1" ||
    v6.startsWith("fc") || v6.startsWith("fd") || // unique local
    /^fe[89ab]/.test(v6) // link local
  );
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
}

/** Cheap syntactic check, used when a partner saves a webhook URL. */
export function isForbiddenWebhookHost(hostname: string): boolean {
  const host = stripBrackets(hostname.toLowerCase());
  const isIpLiteral = host.includes(":") || /^[\d.]+$/.test(host);
  if (isIpLiteral) return isPrivateIp(host);
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".") // single-label names resolve inside the private network
  );
}

/** Full check at delivery time: also resolves DNS and rejects private targets. */
export async function assertPublicWebhookUrl(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Webhook URL must use HTTPS");
  const host = stripBrackets(url.hostname.toLowerCase());
  if (isForbiddenWebhookHost(host)) throw new Error("Webhook URL points to a private host");
  if (host.includes(":") || /^[\d.]+$/.test(host)) return; // IP literal, already checked

  const addresses: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      addresses.push(...(await Deno.resolveDns(host, type)));
    } catch {
      /* no records of this type */
    }
  }
  if (addresses.length === 0) throw new Error("Webhook host does not resolve");
  if (addresses.some(isPrivateIp)) throw new Error("Webhook URL resolves to a private address");
}

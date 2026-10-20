/** Webhook signing + secret generation for Partner API. */

const WEBHOOK_SECRET_PREFIX = "mwh_";

export function generateWebhookSecret(): { secret: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const secret = `${WEBHOOK_SECRET_PREFIX}${hex}`;
  const prefix = secret.slice(0, 12);
  return { secret, prefix };
}

export async function signWebhookPayload(
  rawBody: string,
  secret: string,
  timestampSec?: number,
): Promise<string> {
  const t = timestampSec ?? Math.floor(Date.now() / 1000);
  const signed = `${t}.${rawBody}`;
  const v1 = await hmacSha256Hex(secret, signed);
  return `t=${t},v1=${v1}`;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

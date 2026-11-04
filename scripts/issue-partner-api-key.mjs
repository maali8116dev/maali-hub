#!/usr/bin/env node
/**
 * Issue a Partner API key for a partner_id.
 *
 * Usage:
 *   node scripts/issue-partner-api-key.mjs <partner_id> [--env test|live] [--days 365] [--scopes a,b,c]
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.supabase or env.
 */

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.supabase") });
config({ path: resolve(process.cwd(), ".env") });

const DEFAULT_SCOPES = [
  "opportunities:read",
  "opportunities:write",
  "applications:read",
  "applications:read_pii",
  "webhooks:manage",
];

function parseArgs(argv) {
  const positional = [];
  let env = "test";
  let days = 365;
  let scopes = DEFAULT_SCOPES;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--env") env = argv[++i] ?? "test";
    else if (a === "--days") days = Number(argv[++i] ?? 365);
    else if (a === "--scopes") scopes = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (!a.startsWith("--")) positional.push(a);
  }

  return { partnerId: Number(positional[0]), env, days, scopes };
}

function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

function generateApiKey(environment) {
  const prefix = environment === "live" ? "mpk_live_" : "mpk_test_";
  const suffix = randomBytes(24).toString("hex");
  const key = `${prefix}${suffix}`;
  const displayPrefix = key.slice(0, 12);
  return { key, displayPrefix };
}

async function main() {
  const { partnerId, env, days, scopes: requestedScopes } = parseArgs(process.argv.slice(2));

  if (!partnerId || Number.isNaN(partnerId)) {
    console.error("Usage: node scripts/issue-partner-api-key.mjs <partner_id> [--env test|live] [--days 365]");
    process.exit(1);
  }

  const WRITE_SCOPES = new Set(["opportunities:write", "webhooks:manage", "applications:read_pii"]);
  const scopes = env === "test"
    ? requestedScopes.filter((s) => !WRITE_SCOPES.has(s))
    : requestedScopes;

  if (!scopes.length) {
    console.error("Test keys require at least one allowed read scope (write and PII scopes are not allowed)");
    process.exit(1);
  }

  if (!["test", "live"].includes(env)) {
    console.error("--env must be test or live");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  const { data: partner, error: partnerErr } = await supabase
    .from("partners")
    .select("id, name")
    .eq("id", partnerId)
    .maybeSingle();

  if (partnerErr || !partner) {
    console.error("Partner not found:", partnerErr?.message ?? partnerId);
    process.exit(1);
  }

  const { key, displayPrefix } = generateApiKey(env);
  const keyHash = sha256Hex(key);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("partner_api_keys")
    .insert({
      partner_id: partnerId,
      key_hash: keyHash,
      key_prefix: displayPrefix,
      scopes,
      environment: env,
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();

  if (error) {
    console.error("Failed to insert API key:", error.message);
    process.exit(1);
  }

  console.log(JSON.stringify({
    partnerId: partner.id,
    partnerName: partner.name,
    apiKeyId: data.id,
    environment: env,
    scopes,
    expiresAt: data.expires_at,
    keyPrefix: displayPrefix,
    apiKey: key,
  }, null, 2));
  console.error("\nStore the apiKey securely — it will not be shown again.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

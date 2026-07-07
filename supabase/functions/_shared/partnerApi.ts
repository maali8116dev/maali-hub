/**
 * Partner API core utilities — auth, rate limits, idempotency, mappers.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

export const PARTNER_API_SCOPES = [
  "opportunities:read",
  "opportunities:write",
  "applications:read",
  "applications:read_pii",
  "webhooks:manage",
] as const;

export type PartnerScope = (typeof PARTNER_API_SCOPES)[number];

/** Scopes that imply mutating API routes — never granted on test keys. */
export const PARTNER_API_WRITE_SCOPES = [
  "opportunities:write",
  "webhooks:manage",
] as const;

/** Scopes never granted on test keys. */
export const PARTNER_API_TEST_FORBIDDEN_SCOPES = [
  "opportunities:write",
  "webhooks:manage",
  "applications:read_pii",
] as const;

export function filterScopesForEnvironment(
  environment: "test" | "live",
  scopes: string[],
): string[] {
  if (environment === "live") return scopes;
  return scopes.filter((s) => !(PARTNER_API_TEST_FORBIDDEN_SCOPES as readonly string[]).includes(s));
}

export function canIncludeApplicationPii(ctx: PartnerAuthContext): boolean {
  return ctx.environment === "live" && ctx.scopes.includes("applications:read_pii");
}

export function isPartnerApiWriteRequest(method: string, route: ParsedRoute): boolean {
  if (method === "GET") return false;

  switch (route.resource) {
    case "opportunities":
      return method === "POST" || method === "PATCH";
    case "organization":
      return method === "PATCH";
    case "webhooks":
      return method === "PUT" || (route.id === "rotate-secret" && method === "POST");
    default:
      return false;
  }
}

export function requireLiveKeyForWrite(ctx: PartnerAuthContext): PartnerAuthError | null {
  if (ctx.environment === "test") {
    return {
      error: "Test API keys are read-only",
      errorCode: "TEST_KEY_READONLY",
      status: 403,
    };
  }
  return null;
}

export interface PartnerAuthContext {
  partnerId: number;
  apiKeyId: string;
  scopes: string[];
  environment: "test" | "live";
}

export interface PartnerAuthError {
  error: string;
  errorCode: string;
  status: number;
}

export interface RateLimitInfo {
  remaining: number;
  resetAt: string;
}

export interface ParsedRoute {
  resource: string;
  id?: string;
  sub?: string;
}

const OPPORTUNITY_STATUSES = new Set(["open", "closed", "archived"]);
const APPLICATION_STATUSES = new Set([
  "pending",
  "under_review",
  "approved",
  "rejected",
]);

export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function canonicalJsonHash(body: unknown): Promise<string> {
  return sha256Hex(stableStringify(body ?? {}));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function getPartnerApiCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("Origin") || "";
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  const devOrigins = ["http://127.0.0.1:8080", "http://localhost:8080"];
  const allowed = envOrigins
    ? envOrigins.split(",").map((o) => o.trim()).filter(Boolean).filter((o) => o !== "*")
    : devOrigins;

  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-api-key, idempotency-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
    Vary: "Origin",
  };
}

export const PARTNER_INTERNAL_ERROR_BODY = {
  error: "Internal server error",
  errorCode: "INTERNAL_ERROR",
} as const;

export function partnerInternalError(
  status = 500,
): { status: number; body: typeof PARTNER_INTERNAL_ERROR_BODY } {
  return { status, body: { ...PARTNER_INTERNAL_ERROR_BODY } };
}

export function partnerJsonResponse(
  req: Request,
  status: number,
  body: Record<string, unknown>,
  rateLimit?: RateLimitInfo,
): Response {
  const headers: Record<string, string> = {
    ...getPartnerApiCorsHeaders(req),
    "Content-Type": "application/json",
  };
  if (rateLimit) {
    headers["X-RateLimit-Remaining"] = String(rateLimit.remaining);
    headers["X-RateLimit-Reset"] = rateLimit.resetAt;
    if (status === 429) {
      const retrySec = Math.max(
        1,
        Math.ceil((new Date(rateLimit.resetAt).getTime() - Date.now()) / 1000),
      );
      headers["Retry-After"] = String(retrySec);
    }
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function parseRoute(pathname: string): ParsedRoute | null {
  let path = "";

  const afterPartnerApi = pathname.match(/\/partner-api\/v1\/(.*)$/);
  if (afterPartnerApi) {
    path = afterPartnerApi[1];
  } else {
    const v1 = pathname.match(/\/v1\/(.*)$/);
    path = v1 ? v1[1] : pathname.replace(/^\//, "");
  }

  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return null;

  const [resource, id, sub] = parts;
  return { resource, id, sub };
}

export function extractApiKey(req: Request): string | null {
  const h =
    req.headers.get("X-API-Key") ||
    req.headers.get("x-api-key");
  return h?.trim() || null;
}

export async function authenticatePartnerApiKey(
  req: Request,
  supabase: SupabaseClient = getSupabaseAdmin(),
): Promise<PartnerAuthContext | PartnerAuthError> {
  const rawKey = extractApiKey(req);
  if (!rawKey) {
    return { error: "Missing API key", errorCode: "UNAUTHORIZED", status: 401 };
  }

  const keyHash = await sha256Hex(rawKey);

  const { data: row, error } = await supabase
    .from("partner_api_keys")
    .select("id, partner_id, scopes, environment, expires_at, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !row) {
    return { error: "Invalid API key", errorCode: "UNAUTHORIZED", status: 401 };
  }

  if (row.revoked_at) {
    return { error: "API key revoked", errorCode: "KEY_EXPIRED", status: 401 };
  }

  const expiresAt = new Date(row.expires_at);
  if (expiresAt.getTime() <= Date.now()) {
    return { error: "API key expired", errorCode: "KEY_EXPIRED", status: 401 };
  }

  void supabase
    .from("partner_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    partnerId: row.partner_id,
    apiKeyId: row.id,
    scopes: filterScopesForEnvironment(
      row.environment as "test" | "live",
      row.scopes ?? [],
    ),
    environment: row.environment as "test" | "live",
  };
}

export function requireScope(
  ctx: PartnerAuthContext,
  scope: PartnerScope,
): PartnerAuthError | null {
  if (!ctx.scopes.includes(scope)) {
    return {
      error: `Missing required scope: ${scope}`,
      errorCode: "FORBIDDEN_SCOPE",
      status: 403,
    };
  }
  return null;
}

async function fetchRateLimitConfig(
  supabase: SupabaseClient,
  operation: string,
): Promise<{ max: number; window: number }> {
  const { data } = await supabase
    .from("rate_limit_config")
    .select("max_requests, window_minutes")
    .eq("operation_type", operation)
    .maybeSingle();

  if (operation === "partner_api_minute") {
    return { max: data?.max_requests ?? 60, window: data?.window_minutes ?? 1 };
  }
  return { max: data?.max_requests ?? 10000, window: data?.window_minutes ?? 1440 };
}

export async function checkPartnerRateLimit(
  apiKeyId: string,
  supabase: SupabaseClient = getSupabaseAdmin(),
): Promise<{ allowed: true; info: RateLimitInfo } | { allowed: false; info: RateLimitInfo }> {
  const minuteCfg = await fetchRateLimitConfig(supabase, "partner_api_minute");
  const dailyCfg = await fetchRateLimitConfig(supabase, "partner_api_daily");

  const checks = [
    { op: "partner_api_minute", ...minuteCfg },
    { op: "partner_api_daily", ...dailyCfg },
  ];

  let tightest: RateLimitInfo = { remaining: 9999, resetAt: new Date().toISOString() };

  for (const { op, max, window } of checks) {
    const { data: result, error } = await supabase.rpc(
      "check_and_increment_partner_api_rate_limit",
      {
        p_api_key_id: apiKeyId,
        p_operation_type: op,
        p_max_requests: max,
        p_window_minutes: window,
      },
    );

    if (error) {
      console.error("Rate limit check failed:", op, error);
      return {
        allowed: false,
        info: { remaining: 0, resetAt: new Date(Date.now() + 60_000).toISOString() },
      };
    }

    const remaining = Number(result?.remaining ?? max);
    const resetAt = result?.reset_at
      ? new Date(result.reset_at).toISOString()
      : new Date().toISOString();

    if (remaining < tightest.remaining) {
      tightest = { remaining, resetAt };
    }

    if (result && result.allowed === false) {
      return { allowed: false, info: { remaining: 0, resetAt } };
    }
  }

  return { allowed: true, info: tightest };
}

const IDEMPOTENT_METHODS = new Set(["POST", "PATCH", "PUT"]);

export function extractIdempotencyKey(req: Request): string | null {
  const key = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
  return key?.trim() || null;
}

/** Replay cached idempotent response without consuming rate limit. */
export async function tryIdempotencyReplay(
  req: Request,
  ctx: PartnerAuthContext,
  path: string,
  supabase: SupabaseClient = getSupabaseAdmin(),
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  if (!IDEMPOTENT_METHODS.has(req.method)) return null;

  const idempotencyKey = extractIdempotencyKey(req);
  if (!idempotencyKey) return null;

  let body: Record<string, unknown> = {};
  try {
    body = await req.clone().json();
  } catch {
    body = {};
  }

  const requestHash = await canonicalJsonHash(body);
  const cached = await checkIdempotency(
    supabase,
    ctx,
    req.method,
    path,
    idempotencyKey,
    requestHash,
  );

  if (cached.hit) {
    return { status: cached.status, body: cached.body };
  }
  if (cached.conflict) {
    return {
      status: 409,
      body: {
        error: "Idempotency key reused with different request body",
        errorCode: "IDEMPOTENCY_CONFLICT",
      },
    };
  }
  if ("inProgress" in cached && cached.inProgress) {
    return {
      status: 409,
      body: {
        error: "Request with this idempotency key is already in progress",
        errorCode: "IDEMPOTENCY_IN_PROGRESS",
      },
    };
  }
  return null;
}

export async function checkIdempotency(
  supabase: SupabaseClient,
  ctx: PartnerAuthContext,
  method: string,
  path: string,
  idempotencyKey: string,
  requestHash: string,
): Promise<
  | { hit: true; status: number; body: Record<string, unknown> }
  | { hit: false; conflict: true }
  | { hit: false; conflict: false; inProgress: true }
  | { hit: false; conflict: false; inProgress?: false }
> {
  const { data: existing } = await supabase
    .from("partner_api_idempotency")
    .select("request_hash, response_status, response_body, expires_at")
    .eq("api_key_id", ctx.apiKeyId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (!existing) return { hit: false, conflict: false };

  if (new Date(existing.expires_at).getTime() <= Date.now()) {
    await supabase
      .from("partner_api_idempotency")
      .delete()
      .eq("api_key_id", ctx.apiKeyId)
      .eq("idempotency_key", idempotencyKey);
    return { hit: false, conflict: false };
  }

  if (existing.request_hash !== requestHash) {
    return { hit: false, conflict: true };
  }

  if (existing.response_status === 0) {
    return { hit: false, conflict: false, inProgress: true };
  }

  return {
    hit: true,
    status: existing.response_status,
    body: existing.response_body as Record<string, unknown>,
  };
}

/** Reserve idempotency slot before executing write (prevents concurrent duplicates). */
export async function claimIdempotencySlot(
  supabase: SupabaseClient,
  ctx: PartnerAuthContext,
  method: string,
  path: string,
  idempotencyKey: string,
  requestHash: string,
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("partner_api_idempotency").insert({
    partner_id: ctx.partnerId,
    api_key_id: ctx.apiKeyId,
    idempotency_key: idempotencyKey,
    method,
    path,
    request_hash: requestHash,
    response_status: 0,
    response_body: {},
    expires_at: expiresAt,
  });

  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("claimIdempotencySlot failed:", error);
  return false;
}

export async function storeIdempotency(
  supabase: SupabaseClient,
  ctx: PartnerAuthContext,
  method: string,
  path: string,
  idempotencyKey: string,
  requestHash: string,
  status: number,
  body: Record<string, unknown>,
): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("partner_api_idempotency").upsert(
    {
      partner_id: ctx.partnerId,
      api_key_id: ctx.apiKeyId,
      idempotency_key: idempotencyKey,
      method,
      path,
      request_hash: requestHash,
      response_status: status,
      response_body: body,
      expires_at: expiresAt,
    },
    { onConflict: "api_key_id,idempotency_key" },
  );
  if (error) console.error("storeIdempotency failed:", error);
}

export function mapOpportunityToApi(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    deadline: row.deadline,
    opportunityType: row.opportunity_type ?? null,
    fundingType: row.funding_type ?? null,
    fundingAmount: row.funding_amount ?? null,
    currency: row.currency ?? "USD",
    location: row.location,
    country: row.country ?? null,
    sectorId: row.sector_id ?? null,
    experienceLevel: row.experience_level ?? null,
    programFormat: row.program_format ?? null,
    requirements: row.requirements ?? null,
    eligibilityCriteria: row.eligibility_criteria ?? null,
    maxApplicants: row.max_applicants ?? null,
    currentApplicants: row.current_applicants ?? 0,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    imageUrl: row.image_url ?? null,
    featured: row.featured ?? false,
    partnerId: row.partner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const WRITABLE_OPPORTUNITY_FIELDS: Record<string, string> = {
  title: "title",
  description: "description",
  status: "status",
  deadline: "deadline",
  opportunityType: "opportunity_type",
  fundingType: "funding_type",
  fundingAmount: "funding_amount",
  currency: "currency",
  location: "location",
  country: "country",
  sectorId: "sector_id",
  experienceLevel: "experience_level",
  programFormat: "program_format",
  requirements: "requirements",
  eligibilityCriteria: "eligibility_criteria",
  maxApplicants: "max_applicants",
  startDate: "start_date",
  endDate: "end_date",
  imageUrl: "image_url",
};

const IGNORED_OPPORTUNITY_FIELDS = new Set([
  "id", "currentApplicants", "featured", "partnerId", "createdAt", "updatedAt",
]);

export function mapOpportunityFromApi(
  body: Record<string, unknown>,
  partial = false,
): { data: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (IGNORED_OPPORTUNITY_FIELDS.has(key)) continue;
    const col = WRITABLE_OPPORTUNITY_FIELDS[key];
    if (!col) {
      if (!partial) errors.push(`Unknown field: ${key}`);
      continue;
    }
    data[col] = value;
  }

  if (data.status && !OPPORTUNITY_STATUSES.has(String(data.status))) {
    errors.push(`Invalid status: ${data.status}`);
  }

  if (data.deadline) {
    const d = new Date(String(data.deadline));
    if (isNaN(d.getTime())) errors.push("Invalid deadline date");
  }

  return { data, errors };
}

export function mapApplicationToApi(
  row: Record<string, unknown>,
  ranked?: Record<string, unknown>,
  pii?: Record<string, unknown>,
) {
  const base = {
    id: row.id ?? ranked?.application_id,
    opportunityId: row.opportunity_id ?? ranked?.opportunity_id,
    status: row.status ?? ranked?.status,
    projectTitle: row.project_title ?? ranked?.project_title ?? null,
    projectSummary: row.project_summary ?? ranked?.project_summary ?? null,
    primarySectors: row.primary_sectors ?? ranked?.primary_sectors ?? null,
    averageScore: ranked?.average_score != null ? Number(ranked.average_score) : null,
    totalReviews: ranked?.total_reviews != null
      ? Number(ranked.total_reviews)
      : 0,
    rankPosition: ranked?.rank_position != null
      ? Number(ranked.rank_position)
      : null,
    submittedAt: row.created_at ?? ranked?.submitted_at,
    createdAt: row.created_at ?? ranked?.created_at,
    updatedAt: row.updated_at ?? ranked?.updated_at,
  };

  if (!pii) return base;

  return {
    ...base,
    fullLegalName: pii.full_legal_name ?? null,
    contactEmail: pii.contact_email ?? null,
    contactPhone: pii.contact_phone ?? null,
    countryOfResidence: pii.country_of_residence ?? null,
    organizationName: pii.organization_name ?? null,
    linkedinUrl: pii.linkedin_url ?? null,
    githubUrl: pii.github_url ?? null,
    otherSocialLinks: pii.other_social_links ?? null,
    documentUrls: pii.documentUrls ?? [],
  };
}

export function encodeCursor(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify(payload));
}

export function decodeCursor(cursor: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(cursor));
  } catch {
    return null;
  }
}

export async function logPartnerApiAudit(
  supabase: SupabaseClient,
  ctx: PartnerAuthContext,
  method: string,
  path: string,
  statusCode: number,
  errorCode: string | null,
  durationMs: number,
): Promise<void> {
  const { error } = await supabase.from("partner_api_audit_log").insert({
    partner_id: ctx.partnerId,
    api_key_id: ctx.apiKeyId,
    method,
    path,
    status_code: statusCode,
    error_code: errorCode,
    duration_ms: durationMs,
  });
  if (error) console.error("audit log failed:", error);
}

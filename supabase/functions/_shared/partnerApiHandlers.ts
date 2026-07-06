/**
 * Partner API route handlers (service_role scoped to partner_id).
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import {
  PartnerAuthContext,
  RateLimitInfo,
  canonicalJsonHash,
  checkIdempotency,
  claimIdempotencySlot,
  decodeCursor,
  encodeCursor,
  mapApplicationToApi,
  mapOpportunityFromApi,
  mapOpportunityToApi,
  canIncludeApplicationPii,
  partnerJsonResponse,
  requireScope,
  storeIdempotency,
} from "./partnerApi.ts";
import { generateWebhookSecret } from "./partnerWebhookCrypto.ts";
import { sha256Hex } from "./partnerApi.ts";

const DOC_BUCKET = "application-docs";
const SIGNED_URL_TTL = 3600;
const WEBHOOK_EVENTS = [
  "application.submitted",
  "application.status_changed",
  "opportunity.closed",
] as const;

type HandlerResult = { status: number; body: Record<string, unknown> };

async function verifyOpportunityOwnership(
  supabase: SupabaseClient,
  opportunityId: number,
  partnerId: number,
): Promise<boolean> {
  const { data } = await supabase
    .from("opportunities")
    .select("id")
    .eq("id", opportunityId)
    .eq("partner_id", partnerId)
    .maybeSingle();
  return !!data;
}

async function getSignedDocumentUrls(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<string[]> {
  const byApp = await getSignedDocumentUrlsByApplication(supabase, [applicationId]);
  return byApp.get(applicationId) ?? [];
}

async function getSignedDocumentUrlsByApplication(
  supabase: SupabaseClient,
  applicationIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!applicationIds.length) return result;

  const { data: docs } = await supabase
    .from("application_documents")
    .select("application_id, file_path")
    .in("application_id", applicationIds);

  if (!docs?.length) return result;

  for (const doc of docs) {
    const { data } = await supabase.storage
      .from(DOC_BUCKET)
      .createSignedUrl(doc.file_path, SIGNED_URL_TTL);
    if (data?.signedUrl) {
      const urls = result.get(doc.application_id) ?? [];
      urls.push(data.signedUrl);
      result.set(doc.application_id, urls);
    }
  }
  return result;
}

async function handleIdempotentWrite(
  req: Request,
  supabase: SupabaseClient,
  ctx: PartnerAuthContext,
  path: string,
  body: Record<string, unknown>,
  execute: () => Promise<HandlerResult>,
): Promise<HandlerResult> {
  const idempotencyKey = req.headers.get("Idempotency-Key") ||
    req.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return execute();
  }

  const requestHash = await canonicalJsonHash(body);

  const resolveCached = (
    cached: Awaited<ReturnType<typeof checkIdempotency>>,
  ): HandlerResult | null => {
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
  };

  let cached = await checkIdempotency(
    supabase,
    ctx,
    req.method,
    path,
    idempotencyKey,
    requestHash,
  );
  const early = resolveCached(cached);
  if (early) return early;

  const claimed = await claimIdempotencySlot(
    supabase,
    ctx,
    req.method,
    path,
    idempotencyKey,
    requestHash,
  );
  if (!claimed) {
    cached = await checkIdempotency(
      supabase,
      ctx,
      req.method,
      path,
      idempotencyKey,
      requestHash,
    );
    const retry = resolveCached(cached);
    if (retry) return retry;
    return {
      status: 409,
      body: {
        error: "Request with this idempotency key is already in progress",
        errorCode: "IDEMPOTENCY_IN_PROGRESS",
      },
    };
  }

  const result = await execute();
  if (result.status >= 200 && result.status < 300) {
    await storeIdempotency(
      supabase,
      ctx,
      req.method,
      path,
      idempotencyKey,
      requestHash,
      result.status,
      result.body,
    );
  } else {
    await supabase
      .from("partner_api_idempotency")
      .delete()
      .eq("api_key_id", ctx.apiKeyId)
      .eq("idempotency_key", idempotencyKey)
      .eq("response_status", 0);
  }
  return result;
}

export async function listOpportunities(
  req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "opportunities:read");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const status = url.searchParams.get("status");
  const cursor = url.searchParams.get("cursor");

  let query = supabase
    .from("opportunities")
    .select("*")
    .eq("partner_id", ctx.partnerId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (status) query = query.eq("status", status);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded?.created_at && decoded?.id != null) {
      const createdAt = String(decoded.created_at);
      const cursorId = Number(decoded.id);
      query = query.or(
        `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt.${cursorId})`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    return { status: 500, body: { error: error.message, errorCode: "INTERNAL_ERROR" } };
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    status: 200,
    body: {
      data: page.map((r) => mapOpportunityToApi(r)),
      next_cursor: hasMore && last
        ? encodeCursor({ id: last.id, created_at: last.created_at })
        : null,
    },
  };
}

export async function getOpportunity(
  req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
  id: number,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "opportunities:read");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .eq("partner_id", ctx.partnerId)
    .maybeSingle();

  if (error) {
    return { status: 500, body: { error: error.message, errorCode: "INTERNAL_ERROR" } };
  }
  if (!data) {
    return { status: 404, body: { error: "Opportunity not found", errorCode: "NOT_FOUND" } };
  }

  return { status: 200, body: { data: mapOpportunityToApi(data) } };
}

export async function createOpportunity(
  req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
  path: string,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "opportunities:write");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return { status: 400, body: { error: "Invalid JSON body", errorCode: "VALIDATION_ERROR" } };
  }

  const mapped = mapOpportunityFromApi(body, false);
  if (!body.title || !body.description || !body.deadline || !body.location) {
    mapped.errors.push("title, description, deadline, and location are required");
  }
  if (mapped.errors.length) {
    return { status: 400, body: { error: mapped.errors.join("; "), errorCode: "VALIDATION_ERROR" } };
  }

  const insertRow = {
    ...mapped.data,
    status: mapped.data.status ?? "open",
    currency: mapped.data.currency ?? "USD",
    application_fee: 0,
    partner_id: ctx.partnerId,
    funding_amount: mapped.data.opportunity_type === "grant"
      ? mapped.data.funding_amount ?? null
      : null,
  };

  const run = async (): Promise<HandlerResult> => {
    const { data, error } = await supabase
      .from("opportunities")
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      return { status: 500, body: { error: error.message, errorCode: "INTERNAL_ERROR" } };
    }
    return { status: 201, body: { data: mapOpportunityToApi(data) } };
  };

  const result = await handleIdempotentWrite(req, supabase, ctx, path, body, run);
  return result;
}

export async function patchOpportunity(
  req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
  id: number,
  path: string,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "opportunities:write");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  if (!(await verifyOpportunityOwnership(supabase, id, ctx.partnerId))) {
    return { status: 404, body: { error: "Opportunity not found", errorCode: "NOT_FOUND" } };
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return { status: 400, body: { error: "Invalid JSON body", errorCode: "VALIDATION_ERROR" } };
  }

  const mapped = mapOpportunityFromApi(body, true);
  if (mapped.errors.length) {
    return { status: 400, body: { error: mapped.errors.join("; "), errorCode: "VALIDATION_ERROR" } };
  }
  if (!Object.keys(mapped.data).length) {
    return { status: 400, body: { error: "No valid fields to update", errorCode: "VALIDATION_ERROR" } };
  }

  if (mapped.data.opportunity_type === "grant" && "funding_amount" in mapped.data) {
    // keep funding_amount
  } else if ("opportunity_type" in mapped.data && mapped.data.opportunity_type !== "grant") {
    mapped.data.funding_amount = null;
  }

  const run = async (): Promise<HandlerResult> => {
    const { data, error } = await supabase
      .from("opportunities")
      .update({ ...mapped.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("partner_id", ctx.partnerId)
      .select()
      .single();

    if (error) {
      return { status: 500, body: { error: error.message, errorCode: "INTERNAL_ERROR" } };
    }
    return { status: 200, body: { data: mapOpportunityToApi(data) } };
  };

  const result = await handleIdempotentWrite(req, supabase, ctx, path, body, run);
  return result;
}

export async function closeOpportunity(
  req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
  id: number,
  path: string,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "opportunities:write");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  if (!(await verifyOpportunityOwnership(supabase, id, ctx.partnerId))) {
    return { status: 404, body: { error: "Opportunity not found", errorCode: "NOT_FOUND" } };
  }

  const body = {};

  const run = async (): Promise<HandlerResult> => {
    const { data, error } = await supabase
      .from("opportunities")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("partner_id", ctx.partnerId)
      .select()
      .single();

    if (error) {
      return { status: 500, body: { error: error.message, errorCode: "INTERNAL_ERROR" } };
    }
    return { status: 200, body: { data: mapOpportunityToApi(data) } };
  };

  const result = await handleIdempotentWrite(req, supabase, ctx, path, body, run);
  return result;
}

export async function listOpportunityApplications(
  req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
  opportunityId: number,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "applications:read");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  if (!(await verifyOpportunityOwnership(supabase, opportunityId, ctx.partnerId))) {
    return { status: 404, body: { error: "Opportunity not found", errorCode: "NOT_FOUND" } };
  }

  const { data, error } = await supabase.rpc("partner_api_list_applications_ranked", {
    p_opportunity_id: opportunityId,
    p_partner_id: ctx.partnerId,
  });

  if (error) {
    return { status: 500, body: { error: error.message, errorCode: "INTERNAL_ERROR" } };
  }

  const rows = data ?? [];
  const includePii = canIncludeApplicationPii(ctx);

  let appById = new Map<string, Record<string, unknown>>();
  let docUrlsByApp = new Map<string, string[]>();

  if (includePii && rows.length) {
    const appIds = rows.map((r: { application_id: string }) => r.application_id);
    const [{ data: apps }, signedUrls] = await Promise.all([
      supabase
        .from("applications")
        .select("id, full_legal_name, contact_email, contact_phone, country_of_residence, organization_name, linkedin_url, github_url, other_social_links")
        .in("id", appIds),
      getSignedDocumentUrlsByApplication(supabase, appIds),
    ]);
    appById = new Map((apps ?? []).map((a) => [a.id, a]));
    docUrlsByApp = signedUrls;
  }

  const items = rows.map((row: Record<string, unknown>) => {
    let pii: Record<string, unknown> | undefined;
    if (includePii) {
      const app = appById.get(String(row.application_id));
      if (app) {
        pii = {
          ...app,
          documentUrls: docUrlsByApp.get(String(row.application_id)) ?? [],
        };
      }
    }
    return mapApplicationToApi({ opportunity_id: opportunityId }, row, pii);
  });

  return { status: 200, body: { data: items } };
}

export async function getApplication(
  req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
  appId: string,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "applications:read");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  const { data: app, error } = await supabase
    .from("applications")
    .select("*")
    .eq("id", appId)
    .eq("is_draft", false)
    .maybeSingle();

  if (error) {
    return { status: 500, body: { error: error.message, errorCode: "INTERNAL_ERROR" } };
  }

  if (!app || !(await verifyOpportunityOwnership(supabase, app.opportunity_id, ctx.partnerId))) {
    return { status: 404, body: { error: "Application not found", errorCode: "NOT_FOUND" } };
  }

  const { data: ranked } = await supabase.rpc("partner_api_list_applications_ranked", {
    p_opportunity_id: app.opportunity_id,
    p_partner_id: ctx.partnerId,
  });

  const rankRow = (ranked ?? []).find(
    (r: { application_id: string }) => r.application_id === appId,
  );

  let pii: Record<string, unknown> | undefined;
  if (canIncludeApplicationPii(ctx)) {
    const documentUrls = await getSignedDocumentUrls(supabase, appId);
    pii = {
      full_legal_name: app.full_legal_name,
      contact_email: app.contact_email,
      contact_phone: app.contact_phone,
      country_of_residence: app.country_of_residence,
      organization_name: app.organization_name,
      linkedin_url: app.linkedin_url,
      github_url: app.github_url,
      other_social_links: app.other_social_links,
      documentUrls,
    };
  }

  return {
    status: 200,
    body: { data: mapApplicationToApi(app, rankRow, pii) },
  };
}

export async function getOrganization(
  _req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "opportunities:read");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  const { data, error } = await supabase
    .from("partners")
    .select("id, name, description, sector, website_url, logo_url, status, created_at, updated_at")
    .eq("id", ctx.partnerId)
    .single();

  if (error || !data) {
    return { status: 404, body: { error: "Organization not found", errorCode: "NOT_FOUND" } };
  }

  return {
    status: 200,
    body: {
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        sector: data.sector,
        websiteUrl: data.website_url,
        logoUrl: data.logo_url,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    },
  };
}

export async function patchOrganization(
  req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "opportunities:write");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return { status: 400, body: { error: "Invalid JSON body", errorCode: "VALIDATION_ERROR" } };
  }

  const fieldMap: Record<string, string> = {
    name: "name",
    description: "description",
    sector: "sector",
    websiteUrl: "website_url",
    logoUrl: "logo_url",
  };

  const update: Record<string, unknown> = {};
  for (const [apiKey, col] of Object.entries(fieldMap)) {
    if (apiKey in body) update[col] = body[apiKey];
  }

  if (!Object.keys(update).length) {
    return { status: 400, body: { error: "No valid fields to update", errorCode: "VALIDATION_ERROR" } };
  }

  if (update.name !== undefined && !String(update.name).trim()) {
    return { status: 400, body: { error: "name cannot be empty", errorCode: "VALIDATION_ERROR" } };
  }

  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("partners")
    .update(update)
    .eq("id", ctx.partnerId)
    .select("id, name, description, sector, website_url, logo_url, status, created_at, updated_at")
    .single();

  if (error) {
    return { status: 500, body: { error: error.message, errorCode: "INTERNAL_ERROR" } };
  }

  return {
    status: 200,
    body: {
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        sector: data.sector,
        websiteUrl: data.website_url,
        logoUrl: data.logo_url,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    },
  };
}

export async function getWebhooks(
  _req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "webhooks:manage");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  const { data } = await supabase
    .from("partner_webhooks")
    .select("endpoint_url, subscribed_events, secret_prefix, updated_at")
    .eq("partner_id", ctx.partnerId)
    .maybeSingle();

  return {
    status: 200,
    body: {
      data: data
        ? {
          endpointUrl: data.endpoint_url,
          subscribedEvents: data.subscribed_events ?? [],
          secretPrefix: data.secret_prefix,
          updatedAt: data.updated_at,
        }
        : {
          endpointUrl: null,
          subscribedEvents: [],
          secretPrefix: null,
          updatedAt: null,
        },
    },
  };
}

export async function putWebhooks(
  req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "webhooks:manage");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return { status: 400, body: { error: "Invalid JSON body", errorCode: "VALIDATION_ERROR" } };
  }

  const endpointUrl = body.endpointUrl as string | undefined;
  const subscribedEvents = body.subscribedEvents as string[] | undefined;

  if (!endpointUrl || !subscribedEvents?.length) {
    return {
      status: 400,
      body: { error: "endpointUrl and subscribedEvents are required", errorCode: "VALIDATION_ERROR" },
    };
  }

  try {
    new URL(endpointUrl);
  } catch {
    return { status: 400, body: { error: "Invalid endpointUrl", errorCode: "VALIDATION_ERROR" } };
  }

  if (!endpointUrl.startsWith("https://")) {
    return { status: 400, body: { error: "endpointUrl must use HTTPS", errorCode: "VALIDATION_ERROR" } };
  }

  const invalid = subscribedEvents.filter((e) => !WEBHOOK_EVENTS.includes(e as typeof WEBHOOK_EVENTS[number]));
  if (invalid.length) {
    return {
      status: 400,
      body: { error: `Invalid events: ${invalid.join(", ")}`, errorCode: "VALIDATION_ERROR" },
    };
  }

  const { data: existing } = await supabase
    .from("partner_webhooks")
    .select("id")
    .eq("partner_id", ctx.partnerId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await supabase
      .from("partner_webhooks")
      .update({
        endpoint_url: endpointUrl,
        subscribed_events: subscribedEvents,
        updated_at: now,
      })
      .eq("partner_id", ctx.partnerId)
      .select("endpoint_url, subscribed_events, secret_prefix, updated_at")
      .single();

    if (error) {
      return { status: 500, body: { error: error.message, errorCode: "INTERNAL_ERROR" } };
    }

    return {
      status: 200,
      body: {
        data: {
          endpointUrl: data.endpoint_url,
          subscribedEvents: data.subscribed_events,
          secretPrefix: data.secret_prefix,
          updatedAt: data.updated_at,
        },
      },
    };
  }

  const { secret, prefix } = generateWebhookSecret();
  const secretHash = await sha256Hex(secret);

  const { data, error } = await supabase
    .from("partner_webhooks")
    .insert({
      partner_id: ctx.partnerId,
      endpoint_url: endpointUrl,
      subscribed_events: subscribedEvents,
      secret_hash: secretHash,
      secret_prefix: prefix,
      signing_secret: secret,
      updated_at: now,
    })
    .select("endpoint_url, subscribed_events, secret_prefix, updated_at")
    .single();

  if (error) {
    return { status: 500, body: { error: error.message, errorCode: "INTERNAL_ERROR" } };
  }

  return {
    status: 200,
    body: {
      data: {
        endpointUrl: data.endpoint_url,
        subscribedEvents: data.subscribed_events,
        secretPrefix: data.secret_prefix,
        updatedAt: data.updated_at,
        signingSecret: secret,
      },
    },
  };
}

export async function rotateWebhookSecret(
  _req: Request,
  ctx: PartnerAuthContext,
  supabase: SupabaseClient,
): Promise<HandlerResult> {
  const scopeErr = requireScope(ctx, "webhooks:manage");
  if (scopeErr) return { status: scopeErr.status, body: { error: scopeErr.error, errorCode: scopeErr.errorCode } };

  const { data: existing } = await supabase
    .from("partner_webhooks")
    .select("id")
    .eq("partner_id", ctx.partnerId)
    .maybeSingle();

  if (!existing) {
    return { status: 404, body: { error: "Webhook not configured", errorCode: "NOT_FOUND" } };
  }

  const { secret, prefix } = generateWebhookSecret();
  const secretHash = await sha256Hex(secret);

  const { error } = await supabase
    .from("partner_webhooks")
    .update({
      secret_hash: secretHash,
      secret_prefix: prefix,
      signing_secret: secret,
      updated_at: new Date().toISOString(),
    })
    .eq("partner_id", ctx.partnerId);

  if (error) {
    return { status: 500, body: { error: error.message, errorCode: "INTERNAL_ERROR" } };
  }

  return {
    status: 200,
    body: {
      data: {
        secretPrefix: prefix,
        signingSecret: secret,
      },
    },
  };
}

export function toPartnerResponse(
  req: Request,
  result: HandlerResult,
  rateLimit?: RateLimitInfo,
): Response {
  return partnerJsonResponse(req, result.status, result.body, rateLimit);
}

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  authenticatePartnerApiKey,
  checkPartnerRateLimit,
  getPartnerApiCorsHeaders,
  getSupabaseAdmin,
  logPartnerApiAudit,
  parseRoute,
  partnerJsonResponse,
  PartnerAuthContext,
  PartnerAuthError,
  isPartnerApiWriteRequest,
  requireLiveKeyForWrite,
  tryIdempotencyReplay,
} from "../_shared/partnerApi.ts";
import {
  closeOpportunity,
  createOpportunity,
  getApplication,
  getOpportunity,
  getOrganization,
  getWebhooks,
  listOpportunities,
  listOpportunityApplications,
  patchOpportunity,
  patchOrganization,
  putWebhooks,
  rotateWebhookSecret,
  toPartnerResponse,
} from "../_shared/partnerApiHandlers.ts";

const supabaseAdmin = getSupabaseAdmin();

function isAuthError(v: PartnerAuthContext | PartnerAuthError): v is PartnerAuthError {
  return "errorCode" in v && "status" in v && !("partnerId" in v);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getPartnerApiCorsHeaders(req) });
  }

  const started = Date.now();
  const url = new URL(req.url);
  const routePath = (() => {
    const m = url.pathname.match(/\/partner-api(\/v1\/.*)$/);
    if (m) return m[1];
    const v1 = url.pathname.match(/(\/v1\/.*)$/);
    return v1 ? v1[1] : url.pathname;
  })();

  let ctx: PartnerAuthContext | null = null;
  let rateInfo;

  try {
    const auth = await authenticatePartnerApiKey(req, supabaseAdmin);
    if (isAuthError(auth)) {
      return partnerJsonResponse(req, auth.status, {
        error: auth.error,
        errorCode: auth.errorCode,
      });
    }
    ctx = auth;

    const route = parseRoute(url.pathname);
    if (!route) {
      const resp = partnerJsonResponse(req, 404, {
        error: "Not found",
        errorCode: "NOT_FOUND",
      });
      await logPartnerApiAudit(
        supabaseAdmin, ctx, req.method, routePath, 404, "NOT_FOUND", Date.now() - started,
      );
      return resp;
    }

    if (isPartnerApiWriteRequest(req.method, route)) {
      const writeErr = requireLiveKeyForWrite(ctx);
      if (writeErr) {
        const resp = partnerJsonResponse(req, writeErr.status, {
          error: writeErr.error,
          errorCode: writeErr.errorCode,
        });
        await logPartnerApiAudit(
          supabaseAdmin, ctx, req.method, routePath, writeErr.status, writeErr.errorCode, Date.now() - started,
        );
        return resp;
      }
    }

    const idempotentReplay = await tryIdempotencyReplay(req, ctx, routePath, supabaseAdmin);
    if (idempotentReplay) {
      const resp = partnerJsonResponse(req, idempotentReplay.status, idempotentReplay.body);
      await logPartnerApiAudit(
        supabaseAdmin,
        ctx,
        req.method,
        routePath,
        idempotentReplay.status,
        typeof idempotentReplay.body.errorCode === "string"
          ? idempotentReplay.body.errorCode
          : null,
        Date.now() - started,
      );
      return resp;
    }

    const rl = await checkPartnerRateLimit(ctx.apiKeyId, supabaseAdmin);
    rateInfo = rl.info;
    if (!rl.allowed) {
      const resp = partnerJsonResponse(req, 429, {
        error: "Rate limit exceeded",
        errorCode: "RATE_LIMITED",
      }, rl.info);
      await logPartnerApiAudit(
        supabaseAdmin, ctx, req.method, routePath, 429, "RATE_LIMITED", Date.now() - started,
      );
      return resp;
    }

    let result;

    switch (route.resource) {
      case "opportunities":
        if (!route.id && req.method === "GET") {
          result = await listOpportunities(req, ctx, supabaseAdmin);
        } else if (!route.id && req.method === "POST") {
          result = await createOpportunity(req, ctx, supabaseAdmin, routePath);
        } else if (route.id && !route.sub && req.method === "GET") {
          result = await getOpportunity(req, ctx, supabaseAdmin, Number(route.id));
        } else if (route.id && !route.sub && req.method === "PATCH") {
          result = await patchOpportunity(req, ctx, supabaseAdmin, Number(route.id), routePath);
        } else if (route.id && route.sub === "applications" && req.method === "GET") {
          result = await listOpportunityApplications(req, ctx, supabaseAdmin, Number(route.id));
        } else if (route.id && route.sub === "close" && req.method === "POST") {
          result = await closeOpportunity(req, ctx, supabaseAdmin, Number(route.id), routePath);
        } else {
          result = { status: 404, body: { error: "Not found", errorCode: "NOT_FOUND" } };
        }
        break;

      case "applications":
        if (route.id && req.method === "GET") {
          result = await getApplication(req, ctx, supabaseAdmin, route.id);
        } else {
          result = { status: 404, body: { error: "Not found", errorCode: "NOT_FOUND" } };
        }
        break;

      case "organization":
        if (req.method === "GET") {
          result = await getOrganization(req, ctx, supabaseAdmin);
        } else if (req.method === "PATCH") {
          result = await patchOrganization(req, ctx, supabaseAdmin);
        } else {
          result = { status: 404, body: { error: "Not found", errorCode: "NOT_FOUND" } };
        }
        break;

      case "webhooks":
        if (!route.id && req.method === "GET") {
          result = await getWebhooks(req, ctx, supabaseAdmin);
        } else if (!route.id && req.method === "PUT") {
          result = await putWebhooks(req, ctx, supabaseAdmin);
        } else if (route.id === "rotate-secret" && req.method === "POST") {
          result = await rotateWebhookSecret(req, ctx, supabaseAdmin);
        } else {
          result = { status: 404, body: { error: "Not found", errorCode: "NOT_FOUND" } };
        }
        break;

      default:
        result = { status: 404, body: { error: "Not found", errorCode: "NOT_FOUND" } };
    }

    const response = toPartnerResponse(req, result, rateInfo);
    await logPartnerApiAudit(
      supabaseAdmin,
      ctx,
      req.method,
      routePath,
      result.status,
      typeof result.body.errorCode === "string" ? result.body.errorCode : null,
      Date.now() - started,
    );
    return response;
  } catch (err) {
    console.error("partner-api error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    if (ctx) {
      await logPartnerApiAudit(
        supabaseAdmin, ctx, req.method, routePath, 500, "INTERNAL_ERROR", Date.now() - started,
      );
    }
    return partnerJsonResponse(req, 500, {
      error: message,
      errorCode: "INTERNAL_ERROR",
    }, rateInfo);
  }
});

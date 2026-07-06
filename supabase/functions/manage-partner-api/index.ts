import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authenticateRequest, jsonResponse } from "../_shared/auth.ts";
import { getSupabaseAdmin, sha256Hex, filterScopesForEnvironment } from "../_shared/partnerApi.ts";
import { generateWebhookSecret } from "../_shared/partnerWebhookCrypto.ts";

const supabaseAdmin = getSupabaseAdmin();

const DEFAULT_SCOPES = [
  "opportunities:read",
  "opportunities:write",
  "applications:read",
  "applications:read_pii",
  "webhooks:manage",
];

const WEBHOOK_EVENTS = [
  "application.submitted",
  "application.status_changed",
  "opportunity.closed",
] as const;

async function resolvePartnerAdmin(userId: string): Promise<{ partnerId: number } | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("partner_id, partner_role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.partner_id && profile.partner_role === "admin") {
    return { partnerId: profile.partner_id };
  }

  const { data: legacy } = await supabaseAdmin
    .from("partners")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return legacy?.id ? { partnerId: legacy.id } : null;
}

function generateApiKey(environment: "test" | "live") {
  const prefix = environment === "live" ? "mpk_live_" : "mpk_test_";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const key = `${prefix}${suffix}`;
  return { key, displayPrefix: key.slice(0, 12) };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  const body = await req.json().catch(() => ({}));
  const auth = await authenticateRequest(req, { bodyToken: body.token ?? null });

  if (!auth.user) {
    return jsonResponse(req, 401, { error: auth.error ?? "Unauthorized" });
  }

  const admin = await resolvePartnerAdmin(auth.user.id);
  if (!admin) {
    return jsonResponse(req, 403, { error: "Partner organization admin access required" });
  }

  const action = body.action as string | undefined;
  const partnerId = admin.partnerId;

  try {
    switch (action) {
      case "list_keys": {
        const { data, error } = await supabaseAdmin
          .from("partner_api_keys")
          .select("id, key_prefix, scopes, environment, last_used_at, expires_at, created_at, revoked_at")
          .eq("partner_id", partnerId)
          .is("revoked_at", null)
          .order("created_at", { ascending: false });

        if (error) return jsonResponse(req, 500, { error: error.message });
        return jsonResponse(req, 200, { data: data ?? [] });
      }

      case "create_key": {
        const environment = body.environment === "live" ? "live" : "test";
        const days = Math.min(365, Math.max(1, Number(body.days) || 365));
        const requestedScopes = Array.isArray(body.scopes)
          ? body.scopes.filter((s: string) => DEFAULT_SCOPES.includes(s))
          : DEFAULT_SCOPES;
        const scopes = filterScopesForEnvironment(environment, requestedScopes);

        if (!scopes.length) {
          return jsonResponse(req, 400, {
            error: environment === "test"
              ? "Test keys require at least one allowed read scope (write and PII scopes are not allowed)"
              : "At least one scope is required",
          });
        }

        const { key, displayPrefix } = generateApiKey(environment);
        const keyHash = await sha256Hex(key);
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
          .from("partner_api_keys")
          .insert({
            partner_id: partnerId,
            key_hash: keyHash,
            key_prefix: displayPrefix,
            scopes,
            environment,
            expires_at: expiresAt,
          })
          .select("id, key_prefix, scopes, environment, expires_at, created_at")
          .single();

        if (error) return jsonResponse(req, 500, { error: error.message });

        return jsonResponse(req, 201, {
          data: { ...data, apiKey: key },
        });
      }

      case "revoke_key": {
        const keyId = body.keyId as string | undefined;
        if (!keyId) return jsonResponse(req, 400, { error: "keyId is required" });

        const { data, error } = await supabaseAdmin
          .from("partner_api_keys")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", keyId)
          .eq("partner_id", partnerId)
          .is("revoked_at", null)
          .select("id")
          .maybeSingle();

        if (error) return jsonResponse(req, 500, { error: error.message });
        if (!data) return jsonResponse(req, 404, { error: "API key not found" });

        return jsonResponse(req, 200, { data: { id: data.id } });
      }

      case "get_webhook": {
        const { data } = await supabaseAdmin
          .from("partner_webhooks")
          .select("endpoint_url, subscribed_events, secret_prefix, updated_at")
          .eq("partner_id", partnerId)
          .maybeSingle();

        return jsonResponse(req, 200, {
          data: data
            ? {
              endpointUrl: data.endpoint_url,
              subscribedEvents: data.subscribed_events ?? [],
              secretPrefix: data.secret_prefix,
              updatedAt: data.updated_at,
            }
            : null,
        });
      }

      case "save_webhook": {
        const endpointUrl = body.endpointUrl as string | undefined;
        const subscribedEvents = body.subscribedEvents as string[] | undefined;

        if (!endpointUrl || !subscribedEvents?.length) {
          return jsonResponse(req, 400, {
            error: "endpointUrl and subscribedEvents are required",
          });
        }

        try {
          new URL(endpointUrl);
        } catch {
          return jsonResponse(req, 400, { error: "Invalid endpointUrl" });
        }

        if (!endpointUrl.startsWith("https://")) {
          return jsonResponse(req, 400, { error: "endpointUrl must use HTTPS" });
        }

        const invalid = subscribedEvents.filter(
          (e) => !WEBHOOK_EVENTS.includes(e as typeof WEBHOOK_EVENTS[number]),
        );
        if (invalid.length) {
          return jsonResponse(req, 400, { error: `Invalid events: ${invalid.join(", ")}` });
        }

        const now = new Date().toISOString();
        const { data: existing } = await supabaseAdmin
          .from("partner_webhooks")
          .select("id")
          .eq("partner_id", partnerId)
          .maybeSingle();

        if (existing) {
          const { data, error } = await supabaseAdmin
            .from("partner_webhooks")
            .update({
              endpoint_url: endpointUrl,
              subscribed_events: subscribedEvents,
              updated_at: now,
            })
            .eq("partner_id", partnerId)
            .select("endpoint_url, subscribed_events, secret_prefix, updated_at")
            .single();

          if (error) return jsonResponse(req, 500, { error: error.message });

          return jsonResponse(req, 200, {
            data: {
              endpointUrl: data.endpoint_url,
              subscribedEvents: data.subscribed_events,
              secretPrefix: data.secret_prefix,
              updatedAt: data.updated_at,
            },
          });
        }

        const { secret, prefix } = generateWebhookSecret();
        const secretHash = await sha256Hex(secret);

        const { data, error } = await supabaseAdmin
          .from("partner_webhooks")
          .insert({
            partner_id: partnerId,
            endpoint_url: endpointUrl,
            subscribed_events: subscribedEvents,
            secret_hash: secretHash,
            secret_prefix: prefix,
            signing_secret: secret,
            updated_at: now,
          })
          .select("endpoint_url, subscribed_events, secret_prefix, updated_at")
          .single();

        if (error) return jsonResponse(req, 500, { error: error.message });

        return jsonResponse(req, 200, {
          data: {
            endpointUrl: data.endpoint_url,
            subscribedEvents: data.subscribed_events,
            secretPrefix: data.secret_prefix,
            updatedAt: data.updated_at,
            signingSecret: secret,
          },
        });
      }

      case "rotate_webhook_secret": {
        const { data: existing } = await supabaseAdmin
          .from("partner_webhooks")
          .select("id")
          .eq("partner_id", partnerId)
          .maybeSingle();

        if (!existing) {
          return jsonResponse(req, 404, { error: "Webhook not configured" });
        }

        const { secret, prefix } = generateWebhookSecret();
        const secretHash = await sha256Hex(secret);

        const { error } = await supabaseAdmin
          .from("partner_webhooks")
          .update({
            secret_hash: secretHash,
            secret_prefix: prefix,
            signing_secret: secret,
            updated_at: new Date().toISOString(),
          })
          .eq("partner_id", partnerId);

        if (error) return jsonResponse(req, 500, { error: error.message });

        return jsonResponse(req, 200, {
          data: { secretPrefix: prefix, signingSecret: secret },
        });
      }

      default:
        return jsonResponse(req, 400, { error: "Unknown action" });
    }
  } catch (err) {
    console.error("manage-partner-api:", err);
    return jsonResponse(req, 500, {
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
});

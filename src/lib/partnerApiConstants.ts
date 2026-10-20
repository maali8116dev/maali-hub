export const PARTNER_API_SCOPES = [
  "opportunities:read",
  "opportunities:write",
  "applications:read",
  "applications:read_pii",
  "webhooks:manage",
] as const;

export const PARTNER_API_WRITE_SCOPES = [
  "opportunities:write",
  "webhooks:manage",
] as const;

export const PARTNER_API_TEST_FORBIDDEN_SCOPES = [
  ...PARTNER_API_WRITE_SCOPES,
  "applications:read_pii",
] as const;

export const PARTNER_API_TEST_SCOPES = PARTNER_API_SCOPES.filter(
  (scope) => !(PARTNER_API_TEST_FORBIDDEN_SCOPES as readonly string[]).includes(scope),
);

export type PartnerApiScope = (typeof PARTNER_API_SCOPES)[number];

export const PARTNER_WEBHOOK_EVENTS = [
  "application.submitted",
  "application.status_changed",
  "opportunity.closed",
] as const;

export type PartnerWebhookEvent = (typeof PARTNER_WEBHOOK_EVENTS)[number];

export function getPartnerApiBaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return "";
  return `${url.replace(/\/$/, "")}/functions/v1/partner-api/v1`;
}

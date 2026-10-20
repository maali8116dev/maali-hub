Partner API reference for your organization. All routes are scoped to your `partner_id`.

## Quickstart

1. Create an API key in **Partner portal → API**.
2. Call the API with the `X-API-Key` header.

```bash
curl -s "{{API_BASE_URL}}/organization" \
  -H "X-API-Key: mpk_test_your_key_here"
```

## Authentication

| Header | Value |
|--------|-------|
| `X-API-Key` | `mpk_test_…` or `mpk_live_…` |

Keys are shown **once** at creation. Store them securely.

**Test vs live:** `mpk_test_` and `mpk_live_` are separate credentials. Test keys are **read-only** at the API layer.

**Test key behavior:**

- **Read-only** — `POST`, `PATCH`, and `PUT` (including close opportunity, org update, webhook config) return `403` with `errorCode: TEST_KEY_READONLY`.
- **No PII** — applicant PII and document URLs are never returned; `applications:read_pii` cannot be assigned to test keys. Application responses are summary fields only.
- **Allowed** — `GET` routes (organization, opportunities, applications summary) when the key has the matching read scopes.
- **Same data** — test and live keys read the **same** organization records (not a separate sandbox).
- **Restricted scopes** — `opportunities:write`, `webhooks:manage`, and `applications:read_pii` cannot be assigned to test keys.
- **Webhooks** — configure webhooks in the Partner portal or with a **live** key; test keys cannot call webhook write endpoints.
- **Operational use** — build and debug read paths safely; use live keys for production CRM/ATS writes.

| Scope | Access |
|-------|--------|
| `opportunities:read` | List/get opportunities, organization profile |
| `opportunities:write` | Create, update, close opportunities; update organization |
| `applications:read` | List/get applications (summary, ranked) |
| `applications:read_pii` | Applicant PII + signed document URLs |
| `webhooks:manage` | Configure webhooks (portal or REST API below) |

Expired or revoked keys return `401` with `errorCode: KEY_EXPIRED`.

## Conventions

- **Format:** JSON, UTF-8, `Content-Type: application/json`
- **Timestamps:** ISO 8601 UTC (`2026-07-03T10:00:00Z`)
- **Success responses:** `{ "data": … }`. List endpoints also include `next_cursor` (string or `null`).
- **Pagination:** `?limit=50&cursor=…` (max 100). Response includes `next_cursor`.
- **Idempotency:** Send `Idempotency-Key` on `POST`/`PATCH` writes listed below. Same key + same body returns cached response for 24h.
- **Rate limits:** 60 req/min, 10,000 req/day per key. Headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`. `429` includes `Retry-After`.

### Idempotent writes

| Method | Path |
|--------|------|
| POST | `/opportunities` |
| PATCH | `/opportunities/{id}` |
| POST | `/opportunities/{id}/close` |

## Errors

```json
{ "error": "Human message", "errorCode": "MACHINE_CODE" }
```

| HTTP | errorCode | Meaning |
|------|-----------|---------|
| 400 | `VALIDATION_ERROR` | Invalid body or params |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 401 | `KEY_EXPIRED` | Key expired or revoked |
| 403 | `FORBIDDEN_SCOPE` | Key lacks required scope |
| 403 | `TEST_KEY_READONLY` | Test API key used on a write route |
| 404 | `NOT_FOUND` | Resource not found or not yours |
| 409 | `IDEMPOTENCY_CONFLICT` | Idempotency key reused with different body |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | Same idempotency key already processing |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Server error |

## Endpoints

Base path: `{{API_BASE_URL}}`

### Opportunities

| Method | Path | Scope |
|--------|------|-------|
| GET | `/opportunities` | `opportunities:read` |
| GET | `/opportunities/{id}` | `opportunities:read` |
| POST | `/opportunities` | `opportunities:write` |
| PATCH | `/opportunities/{id}` | `opportunities:write` |
| POST | `/opportunities/{id}/close` | `opportunities:write` |

**List filter:** `GET /opportunities?status=open` — optional `status` is one of `open`, `closed`, or `archived`.

**Create opportunity** (required: `title`, `description`, `deadline`, `location`):

```json
{
  "title": "Agritech Accelerator 2026",
  "description": "12-week program for early-stage founders.",
  "status": "open",
  "deadline": "2026-09-30",
  "opportunityType": "accelerator",
  "location": "Accra, Ghana",
  "currency": "USD"
}
```

**List response:**

```json
{
  "data": [ { "id": 1, "title": "…", "status": "open", "…": "…" } ],
  "next_cursor": "eyJpZCI6MSwiY3JlYXRlZF9hdCI6Li4ufQ=="
}
```

### Applications

| Method | Path | Scope |
|--------|------|-------|
| GET | `/opportunities/{id}/applications` | `applications:read` |
| GET | `/applications/{appId}` | `applications:read` (+ PII if scoped) |

List returns ranked applications with `averageScore`, `totalReviews`, `rankPosition`.

**Without `applications:read_pii`:** summary fields only (`projectTitle`, `projectSummary`, `status`, scores, dates).

**With `applications:read_pii`:** also `fullLegalName`, `contactEmail`, `contactPhone`, `countryOfResidence`, `organizationName`, `linkedinUrl`, `githubUrl`, `otherSocialLinks`, and `documentUrls` (short-lived signed URLs).

### Organization

| Method | Path | Scope |
|--------|------|-------|
| GET | `/organization` | `opportunities:read` |
| PATCH | `/organization` | `opportunities:write` |

**PATCH** accepts any of: `name`, `description`, `sector`, `websiteUrl`, `logoUrl`. `name` cannot be empty.

## Webhooks

Configure in **Partner portal → API**, or via REST with `webhooks:manage`.

| Method | Path | Scope |
|--------|------|-------|
| GET | `/webhooks` | `webhooks:manage` |
| PUT | `/webhooks` | `webhooks:manage` |
| POST | `/webhooks/rotate-secret` | `webhooks:manage` |

**PUT body:** `endpointUrl` (HTTPS), `subscribedEvents` (array). On first setup, response includes `signingSecret` once — store it for signature verification.

### Events

| Event | When |
|-------|------|
| `application.submitted` | Non-draft application submitted |
| `application.status_changed` | Application status changes |
| `opportunity.closed` | Opportunity closed |

### Payload

```json
{
  "id": "evt_…",
  "type": "application.status_changed",
  "createdAt": "2026-07-03T10:00:00Z",
  "data": {
    "applicationId": "uuid",
    "opportunityId": 42,
    "status": "approved",
    "previousStatus": "under_review"
  }
}
```

### Signature verification

Header: `X-Maali-Signature: t=<unix>,v1=<hex>`

`v1 = HMAC_SHA256(secret, "<t>.<raw_body>")`

Reject if timestamp is older than 5 minutes. Deduplicate on `event.id` (at-least-once delivery).

```ts
import crypto from "node:crypto";

function verify(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  return ok && fresh;
}
```

## Transactions

A **transaction** is one successful inbound API request (HTTP 2xx). Webhooks, retries, and failed requests are not counted.

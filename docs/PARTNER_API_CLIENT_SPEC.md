# MAALI Partner API — Client Integration Specification

**Document purpose:** Technical summary for a partner organization (integrator) connecting their CRM/ATS/grants system to MAALI.

**Production hosting (MAALI):** Self-hosted on VPS. Partner systems connect over public HTTPS only; they do not access MAALI infrastructure directly.

**Status:** Partner API v1 is complete for production use with live keys. A dedicated sandbox (isolated data, write testing, sandbox webhooks) is in development. Until then, use read-only `mpk_test_` keys against your organization data for integration testing.

---

## 1. System architecture

### 1.1 Integration context

```
┌─────────────────────────────────────────────────────────────────┐
│  Partner organization system                                    │
│  - Creates/updates opportunities                                │
│  - Reads applications & rankings                                │
│  - Receives webhook callbacks                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              HTTPS / JSON  │  Outbound: partner webhook URL (HTTPS)
              X-API-Key     │  Inbound to partner: X-Maali-Signature
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  MAALI Partner API Gateway                                      │
│  Base URL: https://<api-domain>/partner-api/v1                  │
│  Runtime: Supabase Edge Function (Deno)                         │
│  - API key authentication → partner_id                          │
│  - Scope checks per route                                       │
│  - Rate limiting (per API key)                                  │
│  - Idempotency (writes)                                         │
│  - Audit logging                                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ service role (internal only)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL + Row Level Security                                │
│  All data scoped to partner_id                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Webhook worker (scheduled)                                     │
│  Outbox → HMAC-signed POST to partner endpoint                  │
│  Events: application.submitted, application.status_changed,     │
│          opportunity.closed                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 What the partner system must support

| Requirement       | Specification                                                      |
| ----------------- | ------------------------------------------------------------------ |
| Protocol          | HTTPS only (TLS 1.2+)                                              |
| Request format    | JSON, UTF-8, `Content-Type: application/json`                      |
| Authentication    | Header `X-API-Key: mpk_live_…` or `mpk_test_…`                     |
| Write idempotency | Header `Idempotency-Key` on POST/PATCH writes (recommended UUID)   |
| Webhook endpoint  | Public HTTPS URL; must verify `X-Maali-Signature`                  |
| Clock             | Webhook verification requires ±5 minute timestamp tolerance        |
| Retries           | Partner must tolerate at-least-once webhooks; dedupe on `event.id` |

---

## 2. API Documentation (machine-readable reference)

Codes below are what the integrator must implement against. Stable within API version `/v1`.

### 2.1 API key prefixes

| Prefix      | Meaning                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| `mpk_test_` | Read-only integration credential (GET summary only; no PII; see limitations below) |
| `mpk_live_` | Production credential (read and write per assigned scopes)                         |

Keys are stored by MAALI as SHA-256 hash only. Full secret shown once at creation.

#### Test key limitations

Test keys are **read-only**. They are not a separate sandbox dataset.

| Rule                    | Detail                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Writes blocked**      | All mutating routes return `403` + `errorCode: TEST_KEY_READONLY`.                                           |
| **No PII**              | Applicant PII and signed document URLs are never returned; `applications:read_pii` not allowed on test keys. |
| **Allowed read scopes** | `opportunities:read`, `applications:read` only.                                                              |
| **Same dataset**        | Test and live keys read the same `partner_id` organization data.                                             |
| **Webhooks**            | Configure via Partner portal or a **live** key — not via test key API calls.                                 |
| **Intended use**        | Safe integration testing of read flows; live keys for production writes.                                     |

### 2.2 Authorization scopes

| Scope code              | Grants                                                  |
| ----------------------- | ------------------------------------------------------- |
| `opportunities:read`    | List/get opportunities; GET organization                |
| `opportunities:write`   | Create, update, close opportunities; PATCH organization |
| `applications:read`     | List/get applications (summary, ranked)                 |
| `applications:read_pii` | Applicant PII + signed document URLs                    |
| `webhooks:manage`       | GET/PUT `/webhooks`, POST `/webhooks/rotate-secret`     |

### 2.3 HTTP API error codes (`errorCode`)

Response shape: `{ "error": "<human message>", "errorCode": "<CODE>" }`

| HTTP | errorCode                 | Meaning                                           |
| ---- | ------------------------- | ------------------------------------------------- |
| 400  | `VALIDATION_ERROR`        | Invalid JSON, body, or query params               |
| 401  | `UNAUTHORIZED`            | Missing or invalid API key                        |
| 401  | `KEY_EXPIRED`             | Key revoked or past `expires_at`                  |
| 403  | `FORBIDDEN_SCOPE`         | Key lacks required scope                          |
| 403  | `TEST_KEY_READONLY`       | Test API key used on a write route                |
| 404  | `NOT_FOUND`               | Resource not found or not owned by partner        |
| 409  | `IDEMPOTENCY_CONFLICT`    | Same `Idempotency-Key` reused with different body |
| 409  | `IDEMPOTENCY_IN_PROGRESS` | Same idempotency key already processing           |
| 429  | `RATE_LIMITED`            | Rate limit exceeded                               |
| 500  | `INTERNAL_ERROR`          | Server error                                      |

### 2.4 Rate limit headers

| Header                  | Description                          |
| ----------------------- | ------------------------------------ |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset`     | ISO 8601 reset time                  |
| `Retry-After`           | Seconds (on 429 only)                |

**Limits per API key:** 20 requests/minute; 1,000 successful requests/month (2xx only; see §3).

### 2.5 Webhook event type codes

| Event code                   | When fired                                             |
| ---------------------------- | ------------------------------------------------------ |
| `application.submitted`      | Non-draft application submitted to partner opportunity |
| `application.status_changed` | Application status changes                             |
| `opportunity.closed`         | Opportunity closed                                     |

### 2.6 Webhook signature header

| Header              | Format                                  |
| ------------------- | --------------------------------------- |
| `X-Maali-Signature` | `t=<unix_seconds>,v1=<hex_hmac_sha256>` |
| `X-Maali-Event-Id`  | Event id (same as payload `id`)         |

Verification: `v1 = HMAC_SHA256(signing_secret, "<t>.<raw_body>")`

### 2.7 Opportunity status values (API)

| Value      | Description            |
| ---------- | ---------------------- |
| `open`     | Accepting applications |
| `closed`   | Closed                 |
| `archived` | Archived               |

### 2.8 REST endpoints summary

| Method | Path                               | Required scope                        |
| ------ | ---------------------------------- | ------------------------------------- |
| GET    | `/organization`                    | `opportunities:read`                  |
| PATCH  | `/organization`                    | `opportunities:write`                 |
| GET    | `/opportunities`                   | `opportunities:read`                  |
| GET    | `/opportunities/{id}`              | `opportunities:read`                  |
| POST   | `/opportunities`                   | `opportunities:write`                 |
| PATCH  | `/opportunities/{id}`              | `opportunities:write`                 |
| POST   | `/opportunities/{id}/close`        | `opportunities:write`                 |
| GET    | `/opportunities/{id}/applications` | `applications:read`                   |
| GET    | `/applications/{appId}`            | `applications:read` (+ PII if scoped) |
| GET    | `/webhooks`                        | `webhooks:manage`                     |
| PUT    | `/webhooks`                        | `webhooks:manage`                     |
| POST   | `/webhooks/rotate-secret`          | `webhooks:manage`                     |

### 2.9 Success response envelope

```json
{ "data": { ... } }
```

List endpoints also return:

```json
{ "data": [ ... ], "next_cursor": "<opaque>|null" }
```

**Cursor pagination** (list endpoints only, e.g. `GET /opportunities`):

| Query param | Description                                       |
| ----------- | ------------------------------------------------- |
| `limit`     | Page size (default 50, max 100)                   |
| `cursor`    | Opaque token from previous response `next_cursor` |

First page — omit `cursor`:

```
GET /partner-api/v1/opportunities?limit=50
```

Next page — pass `next_cursor` verbatim as `cursor`:

```
GET /partner-api/v1/opportunities?limit=50&cursor=eyJpZCI6MSwiY3JlYXRlZF9hdCI6Li4ufQ==
```

Repeat until `next_cursor` is `null`. Treat `cursor` as opaque; do not decode or construct it client-side.

---

## 3. Monthly transaction limit

### 3.1 Definition of a transaction

> **One transaction** = one **successful inbound** Partner API request (HTTP **2xx**) from the partner system to MAALI.

**Not counted as transactions:**

- Outbound webhooks (MAALI → partner)
- Failed requests (4xx / 5xx)
- Retries that fail
- Partner portal UI usage

### 3.2 Hard cap

| Limit                                 | Monthly     | Annual                         |
| ------------------------------------- | ----------- | ------------------------------ |
| Successful requests (2xx) per API key | **1,000**   | **~12,000** (12 × monthly cap) |
| Burst rate per API key                | 20 / minute | —                              |

Cap enforced on a **rolling monthly** window per key, not as a single annual bucket. Once the monthly cap is reached, further requests return `429` + `errorCode: RATE_LIMITED` until the next monthly window.

Outbound webhooks are not counted against this cap.

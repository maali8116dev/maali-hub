Partner-API-Referenz für Ihre Organisation. Alle Routen sind auf Ihre `partner_id` beschränkt.

## Schnellstart

1. Erstellen Sie einen API-Schlüssel unter **Partnerportal → API**.
2. Rufen Sie die API mit dem Header `X-API-Key` auf.

```bash
curl -s "{{API_BASE_URL}}/organization" \
  -H "X-API-Key: mpk_test_your_key_here"
```

## Authentifizierung

| Header | Wert |
|--------|------|
| `X-API-Key` | `mpk_test_…` oder `mpk_live_…` |

Schlüssel werden bei der Erstellung **nur einmal** angezeigt. Sicher aufbewahren.

**Test vs. Live:** `mpk_test_`-Schlüssel sind an der API **nur lesend**. `mpk_live_` erlaubt Schreibvorgänge je nach Scope.

**Verhalten von Testschlüsseln:**

- **Nur Lesen** — `POST`, `PATCH`, `PUT` liefern `403` mit `errorCode: TEST_KEY_READONLY`.
- **Keine PII** — keine Bewerber-PII oder Dokument-URLs; `applications:read_pii` auf Testschlüsseln nicht erlaubt.
- **Erlaubt** — `GET`-Routen (Bewerbungszusammenfassung, Organisation, Opportunities).
- **Gleiche Daten** — kein separates Sandbox-Dataset.
- **Eingeschränkte Scopes** — `opportunities:write`, `webhooks:manage`, `applications:read_pii` nicht auf Testschlüsseln.
- **Webhooks** — nur über Partner-Portal oder **Live**-Schlüssel konfigurieren.

| Berechtigung | Zugriff |
|--------------|---------|
| `opportunities:read` | Opportunities und Organisationsprofil lesen |
| `opportunities:write` | Opportunities erstellen, aktualisieren, schließen; Organisation aktualisieren |
| `applications:read` | Bewerbungen lesen (Zusammenfassung, gerankt) |
| `applications:read_pii` | Bewerber-PII + signierte Dokument-URLs |
| `webhooks:manage` | Webhooks konfigurieren (Portal oder REST-API unten) |

Abgelaufene oder widerrufene Schlüssel liefern `401` mit `errorCode: KEY_EXPIRED`.

## Konventionen

- **Format:** JSON, UTF-8, `Content-Type: application/json`
- **Zeitstempel:** ISO 8601 UTC (`2026-07-03T10:00:00Z`)
- **Erfolgsantworten:** `{ "data": … }`. Listen enthalten zusätzlich `next_cursor` (String oder `null`).
- **Paginierung:** `?limit=50&cursor=…` (max. 100). Antwort enthält `next_cursor`.
- **Idempotenz:** `Idempotency-Key` bei unten genannten `POST`/`PATCH`-Schreibvorgängen. Gleicher Key + gleicher Body → gecachte Antwort für 24 h.
- **Limits:** 60 Anfragen/Min., 10.000/Tag pro Schlüssel. Header: `X-RateLimit-Remaining`, `X-RateLimit-Reset`. `429` enthält `Retry-After`.

### Idempotente Schreibvorgänge

| Methode | Pfad |
|--------|------|
| POST | `/opportunities` |
| PATCH | `/opportunities/{id}` |
| POST | `/opportunities/{id}/close` |

## Fehler

```json
{ "error": "Lesbare Meldung", "errorCode": "MASCHINEN_CODE" }
```

| HTTP | errorCode | Bedeutung |
|------|-----------|-----------|
| 400 | `VALIDATION_ERROR` | Ungültiger Body oder Parameter |
| 401 | `UNAUTHORIZED` | API-Schlüssel fehlt oder ungültig |
| 401 | `KEY_EXPIRED` | Schlüssel abgelaufen oder widerrufen |
| 403 | `FORBIDDEN_SCOPE` | Erforderliche Berechtigung fehlt |
| 403 | `TEST_KEY_READONLY` | Testschlüssel für Schreibroute verwendet |
| 404 | `NOT_FOUND` | Ressource nicht gefunden oder nicht Ihre |
| 409 | `IDEMPOTENCY_CONFLICT` | Idempotency-Key mit anderem Body wiederverwendet |
| 429 | `RATE_LIMITED` | Rate-Limit überschritten |
| 500 | `INTERNAL_ERROR` | Serverfehler |

## Endpunkte

Basispfad: `{{API_BASE_URL}}`

### Opportunities

| Methode | Pfad | Berechtigung |
|--------|------|--------------|
| GET | `/opportunities` | `opportunities:read` |
| GET | `/opportunities/{id}` | `opportunities:read` |
| POST | `/opportunities` | `opportunities:write` |
| PATCH | `/opportunities/{id}` | `opportunities:write` |
| POST | `/opportunities/{id}/close` | `opportunities:write` |

**Listenfilter:** `GET /opportunities?status=open` — optionales `status`: `open`, `closed` oder `archived`.

**Opportunity erstellen** (Pflicht: `title`, `description`, `deadline`, `location`):

```json
{
  "title": "Agritech Accelerator 2026",
  "description": "12-wöchiges Programm für Early-Stage-Gründer.",
  "status": "open",
  "deadline": "2026-09-30",
  "opportunityType": "accelerator",
  "location": "Accra, Ghana",
  "currency": "USD"
}
```

**Listen-Antwort:**

```json
{
  "data": [ { "id": 1, "title": "…", "status": "open", "…": "…" } ],
  "next_cursor": "eyJpZCI6MSwiY3JlYXRlZF9hdCI6Li4ufQ=="
}
```

### Bewerbungen

| Methode | Pfad | Berechtigung |
|--------|------|--------------|
| GET | `/opportunities/{id}/applications` | `applications:read` |
| GET | `/applications/{appId}` | `applications:read` (+ PII bei Berechtigung) |

Liste liefert gerankte Bewerbungen mit `averageScore`, `totalReviews`, `rankPosition`.

**Ohne `applications:read_pii`:** nur Zusammenfassung (`projectTitle`, `projectSummary`, `status`, Scores, Daten).

**Mit `applications:read_pii`:** zusätzlich `fullLegalName`, `contactEmail`, `contactPhone`, `countryOfResidence`, `organizationName`, `linkedinUrl`, `githubUrl`, `otherSocialLinks`, und `documentUrls` (kurzlebige signierte URLs).

### Organisation

| Methode | Pfad | Berechtigung |
|--------|------|--------------|
| GET | `/organization` | `opportunities:read` |
| PATCH | `/organization` | `opportunities:write` |

**PATCH** akzeptiert: `name`, `description`, `sector`, `websiteUrl`, `logoUrl`. `name` darf nicht leer sein.

## Webhooks

Konfiguration unter **Partnerportal → API** oder per REST mit `webhooks:manage`.

| Methode | Pfad | Berechtigung |
|--------|------|--------------|
| GET | `/webhooks` | `webhooks:manage` |
| PUT | `/webhooks` | `webhooks:manage` |
| POST | `/webhooks/rotate-secret` | `webhooks:manage` |

**PUT-Body:** `endpointUrl` (HTTPS), `subscribedEvents` (Array). Bei Ersteinrichtung enthält die Antwort einmalig `signingSecret` — für Signaturprüfung speichern.

### Ereignisse

| Ereignis | Wann |
|----------|------|
| `application.submitted` | Nicht-Entwurf-Bewerbung eingereicht |
| `application.status_changed` | Bewerbungsstatus geändert |
| `opportunity.closed` | Opportunity geschlossen |

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

### Signaturprüfung

Header: `X-Maali-Signature: t=<unix>,v1=<hex>`

`v1 = HMAC_SHA256(secret, "<t>.<raw_body>")`

Ablehnen wenn Zeitstempel älter als 5 Minuten. Deduplizieren über `event.id` (At-least-once-Zustellung).

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

## Transaktionen

Eine **Transaktion** ist eine erfolgreiche eingehende API-Anfrage (HTTP 2xx). Webhooks, Wiederholungen und Fehler zählen nicht.

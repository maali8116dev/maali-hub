Référence API partenaire pour votre organisation. Toutes les routes sont limitées à votre `partner_id`.

## Démarrage rapide

1. Créez une clé API dans **Portail partenaire → API**.
2. Appelez l'API avec l'en-tête `X-API-Key`.

```bash
curl -s "{{API_BASE_URL}}/organization" \
  -H "X-API-Key: mpk_test_your_key_here"
```

## Authentification

| En-tête | Valeur |
|--------|--------|
| `X-API-Key` | `mpk_test_…` ou `mpk_live_…` |

Les clés ne sont affichées **qu'une fois** à la création. Conservez-les en lieu sûr.

**Test vs production :** les clés `mpk_test_` sont **lecture seule** à l'API. Les clés `mpk_live_` permettent les écritures selon les portées.

**Comportement des clés test :**

- **Lecture seule** — `POST`, `PATCH`, `PUT` renvoient `403` avec `errorCode: TEST_KEY_READONLY`.
- **Pas de PII** — pas de PII candidat ni d'URLs de documents ; `applications:read_pii` interdit sur les clés test.
- **Autorisé** — routes `GET` (résumé candidatures, organisation, opportunités).
- **Mêmes données** — pas de bac à sable séparé.
- **Portées restreintes** — pas de `opportunities:write`, `webhooks:manage`, ni `applications:read_pii` sur les clés test.
- **Webhooks** — configuration via le portail partenaire ou une clé **live** uniquement.

| Portée | Accès |
|-------|--------|
| `opportunities:read` | Lister/lire les opportunités, profil organisation |
| `opportunities:write` | Créer, modifier, fermer les opportunités ; mettre à jour l'organisation |
| `applications:read` | Lister/lire les candidatures (résumé, classées) |
| `applications:read_pii` | PII candidat + URLs signées des documents |
| `webhooks:manage` | Configurer les webhooks (portail ou API REST ci-dessous) |

Les clés expirées ou révoquées renvoient `401` avec `errorCode: KEY_EXPIRED`.

## Conventions

- **Format :** JSON, UTF-8, `Content-Type: application/json`
- **Horodatages :** ISO 8601 UTC (`2026-07-03T10:00:00Z`)
- **Réponses réussies :** `{ "data": … }`. Les listes incluent aussi `next_cursor` (chaîne ou `null`).
- **Pagination :** `?limit=50&cursor=…` (max 100). Réponse avec `next_cursor`.
- **Idempotence :** Envoyez `Idempotency-Key` sur les écritures `POST`/`PATCH` listées ci-dessous. Même clé + même corps → réponse en cache 24 h.
- **Limites :** 60 req/min, 10 000 req/jour par clé. En-têtes : `X-RateLimit-Remaining`, `X-RateLimit-Reset`. `429` inclut `Retry-After`.

### Écritures idempotentes

| Méthode | Chemin |
|--------|--------|
| POST | `/opportunities` |
| PATCH | `/opportunities/{id}` |
| POST | `/opportunities/{id}/close` |

## Erreurs

```json
{ "error": "Message lisible", "errorCode": "CODE_MACHINE" }
```

| HTTP | errorCode | Signification |
|------|-----------|---------------|
| 400 | `VALIDATION_ERROR` | Corps ou paramètres invalides |
| 401 | `UNAUTHORIZED` | Clé API manquante ou invalide |
| 401 | `KEY_EXPIRED` | Clé expirée ou révoquée |
| 403 | `FORBIDDEN_SCOPE` | Portée requise absente |
| 403 | `TEST_KEY_READONLY` | Clé test utilisée sur une route d'écriture |
| 404 | `NOT_FOUND` | Ressource introuvable ou hors périmètre |
| 409 | `IDEMPOTENCY_CONFLICT` | Clé idempotente réutilisée avec un corps différent |
| 429 | `RATE_LIMITED` | Limite de débit dépassée |
| 500 | `INTERNAL_ERROR` | Erreur serveur |

## Points de terminaison

Chemin de base : `{{API_BASE_URL}}`

### Opportunités

| Méthode | Chemin | Portée |
|--------|--------|--------|
| GET | `/opportunities` | `opportunities:read` |
| GET | `/opportunities/{id}` | `opportunities:read` |
| POST | `/opportunities` | `opportunities:write` |
| PATCH | `/opportunities/{id}` | `opportunities:write` |
| POST | `/opportunities/{id}/close` | `opportunities:write` |

**Filtre liste :** `GET /opportunities?status=open` — `status` optionnel : `open`, `closed` ou `archived`.

**Créer une opportunité** (requis : `title`, `description`, `deadline`, `location`) :

```json
{
  "title": "Accélérateur Agritech 2026",
  "description": "Programme de 12 semaines pour fondateurs en phase initiale.",
  "status": "open",
  "deadline": "2026-09-30",
  "opportunityType": "accelerator",
  "location": "Accra, Ghana",
  "currency": "USD"
}
```

**Réponse liste :**

```json
{
  "data": [ { "id": 1, "title": "…", "status": "open", "…": "…" } ],
  "next_cursor": "eyJpZCI6MSwiY3JlYXRlZF9hdCI6Li4ufQ=="
}
```

### Candidatures

| Méthode | Chemin | Portée |
|--------|--------|--------|
| GET | `/opportunities/{id}/applications` | `applications:read` |
| GET | `/applications/{appId}` | `applications:read` (+ PII si portée) |

La liste renvoie les candidatures classées avec `averageScore`, `totalReviews`, `rankPosition`.

**Sans `applications:read_pii` :** champs résumé uniquement (`projectTitle`, `projectSummary`, `status`, scores, dates).

**Avec `applications:read_pii` :** aussi `fullLegalName`, `contactEmail`, `contactPhone`, `countryOfResidence`, `organizationName`, `linkedinUrl`, `githubUrl`, `otherSocialLinks`, et `documentUrls` (URLs signées à courte durée).

### Organisation

| Méthode | Chemin | Portée |
|--------|--------|--------|
| GET | `/organization` | `opportunities:read` |
| PATCH | `/organization` | `opportunities:write` |

**PATCH** accepte : `name`, `description`, `sector`, `websiteUrl`, `logoUrl`. `name` ne peut pas être vide.

## Webhooks

Configurez dans **Portail partenaire → API**, ou via REST avec `webhooks:manage`.

| Méthode | Chemin | Portée |
|--------|--------|--------|
| GET | `/webhooks` | `webhooks:manage` |
| PUT | `/webhooks` | `webhooks:manage` |
| POST | `/webhooks/rotate-secret` | `webhooks:manage` |

**Corps PUT :** `endpointUrl` (HTTPS), `subscribedEvents` (tableau). À la première configuration, la réponse inclut `signingSecret` une fois — conservez-le pour la vérification de signature.

### Événements

| Événement | Quand |
|-----------|-------|
| `application.submitted` | Candidature non brouillon soumise |
| `application.status_changed` | Changement de statut de candidature |
| `opportunity.closed` | Opportunité fermée |

### Charge utile

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

### Vérification de signature

En-tête : `X-Maali-Signature: t=<unix>,v1=<hex>`

`v1 = HMAC_SHA256(secret, "<t>.<raw_body>")`

Rejetez si l'horodatage a plus de 5 minutes. Dédupliquez sur `event.id` (livraison au moins une fois).

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

Une **transaction** est une requête API entrante réussie (HTTP 2xx). Webhooks, nouvelles tentatives et échecs ne sont pas comptés.

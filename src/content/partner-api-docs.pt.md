Referência da API de parceiros para a sua organização. Todas as rotas estão limitadas ao seu `partner_id`.

## Início rápido

1. Crie uma chave API em **Portal de parceiros → API**.
2. Chame a API com o cabeçalho `X-API-Key`.

```bash
curl -s "{{API_BASE_URL}}/organization" \
  -H "X-API-Key: mpk_test_your_key_here"
```

## Autenticação

| Cabeçalho | Valor |
|-----------|-------|
| `X-API-Key` | `mpk_test_…` ou `mpk_live_…` |

As chaves são mostradas **apenas uma vez** na criação. Guarde-as em segurança.

**Teste vs produção:** chaves `mpk_test_` são **só leitura** na API. Chaves `mpk_live_` permitem escrita conforme os âmbitos.

**Comportamento das chaves de teste:**

- **Só leitura** — `POST`, `PATCH`, `PUT` devolvem `403` com `errorCode: TEST_KEY_READONLY`.
- **Sem PII** — sem PII de candidatos nem URLs de documentos; `applications:read_pii` proibido em chaves de teste.
- **Permitido** — rotas `GET` (resumo de candidaturas, organização, oportunidades).
- **Mesmos dados** — sem sandbox separado.
- **Âmbitos restritos** — sem `opportunities:write`, `webhooks:manage`, nem `applications:read_pii` em chaves de teste.
- **Webhooks** — configurar no portal parceiro ou com chave **live** apenas.

| Âmbito | Acesso |
|--------|--------|
| `opportunities:read` | Listar/obter oportunidades, perfil da organização |
| `opportunities:write` | Criar, atualizar, fechar oportunidades; atualizar organização |
| `applications:read` | Listar/obter candidaturas (resumo, classificadas) |
| `applications:read_pii` | PII do candidato + URLs assinadas de documentos |
| `webhooks:manage` | Configurar webhooks (portal ou API REST abaixo) |

Chaves expiradas ou revogadas devolvem `401` com `errorCode: KEY_EXPIRED`.

## Convenções

- **Formato:** JSON, UTF-8, `Content-Type: application/json`
- **Carimbos de data/hora:** ISO 8601 UTC (`2026-07-03T10:00:00Z`)
- **Respostas de sucesso:** `{ "data": … }`. Listagens incluem também `next_cursor` (string ou `null`).
- **Paginação:** `?limit=50&cursor=…` (máx. 100). Resposta inclui `next_cursor`.
- **Idempotência:** Envie `Idempotency-Key` nas escritas `POST`/`PATCH` listadas abaixo. Mesma chave + mesmo corpo → resposta em cache por 24 h.
- **Limites:** 60 pedidos/min, 10 000 pedidos/dia por chave. Cabeçalhos: `X-RateLimit-Remaining`, `X-RateLimit-Reset`. `429` inclui `Retry-After`.

### Escritas idempotentes

| Método | Caminho |
|--------|---------|
| POST | `/opportunities` |
| PATCH | `/opportunities/{id}` |
| POST | `/opportunities/{id}/close` |

## Erros

```json
{ "error": "Mensagem legível", "errorCode": "CODIGO_MAQUINA" }
```

| HTTP | errorCode | Significado |
|------|-----------|-------------|
| 400 | `VALIDATION_ERROR` | Corpo ou parâmetros inválidos |
| 401 | `UNAUTHORIZED` | Chave API em falta ou inválida |
| 401 | `KEY_EXPIRED` | Chave expirada ou revogada |
| 403 | `FORBIDDEN_SCOPE` | Âmbito necessário em falta |
| 403 | `TEST_KEY_READONLY` | Chave de teste usada numa rota de escrita |
| 404 | `NOT_FOUND` | Recurso não encontrado ou não é seu |
| 409 | `IDEMPOTENCY_CONFLICT` | Chave de idempotência reutilizada com corpo diferente |
| 429 | `RATE_LIMITED` | Limite de taxa excedido |
| 500 | `INTERNAL_ERROR` | Erro do servidor |

## Endpoints

Caminho base: `{{API_BASE_URL}}`

### Oportunidades

| Método | Caminho | Âmbito |
|--------|---------|--------|
| GET | `/opportunities` | `opportunities:read` |
| GET | `/opportunities/{id}` | `opportunities:read` |
| POST | `/opportunities` | `opportunities:write` |
| PATCH | `/opportunities/{id}` | `opportunities:write` |
| POST | `/opportunities/{id}/close` | `opportunities:write` |

**Filtro de lista:** `GET /opportunities?status=open` — `status` opcional: `open`, `closed` ou `archived`.

**Criar oportunidade** (obrigatório: `title`, `description`, `deadline`, `location`):

```json
{
  "title": "Acelerador Agritech 2026",
  "description": "Programa de 12 semanas para fundadores em fase inicial.",
  "status": "open",
  "deadline": "2026-09-30",
  "opportunityType": "accelerator",
  "location": "Accra, Ghana",
  "currency": "USD"
}
```

**Resposta de lista:**

```json
{
  "data": [ { "id": 1, "title": "…", "status": "open", "…": "…" } ],
  "next_cursor": "eyJpZCI6MSwiY3JlYXRlZF9hdCI6Li4ufQ=="
}
```

### Candidaturas

| Método | Caminho | Âmbito |
|--------|---------|--------|
| GET | `/opportunities/{id}/applications` | `applications:read` |
| GET | `/applications/{appId}` | `applications:read` (+ PII se com âmbito) |

A lista devolve candidaturas classificadas com `averageScore`, `totalReviews`, `rankPosition`.

**Sem `applications:read_pii`:** apenas campos de resumo (`projectTitle`, `projectSummary`, `status`, pontuações, datas).

**Com `applications:read_pii`:** também `fullLegalName`, `contactEmail`, `contactPhone`, `countryOfResidence`, `organizationName`, `linkedinUrl`, `githubUrl`, `otherSocialLinks`, e `documentUrls` (URLs assinadas de curta duração).

### Organização

| Método | Caminho | Âmbito |
|--------|---------|--------|
| GET | `/organization` | `opportunities:read` |
| PATCH | `/organization` | `opportunities:write` |

**PATCH** aceita: `name`, `description`, `sector`, `websiteUrl`, `logoUrl`. `name` não pode estar vazio.

## Webhooks

Configure em **Portal de parceiros → API**, ou via REST com `webhooks:manage`.

| Método | Caminho | Âmbito |
|--------|---------|--------|
| GET | `/webhooks` | `webhooks:manage` |
| PUT | `/webhooks` | `webhooks:manage` |
| POST | `/webhooks/rotate-secret` | `webhooks:manage` |

**Corpo PUT:** `endpointUrl` (HTTPS), `subscribedEvents` (array). Na primeira configuração, a resposta inclui `signingSecret` uma vez — guarde-o para verificação de assinatura.

### Eventos

| Evento | Quando |
|--------|--------|
| `application.submitted` | Candidatura não rascunho submetida |
| `application.status_changed` | Estado da candidatura alterado |
| `opportunity.closed` | Oportunidade fechada |

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

### Verificação de assinatura

Cabeçalho: `X-Maali-Signature: t=<unix>,v1=<hex>`

`v1 = HMAC_SHA256(secret, "<t>.<raw_body>")`

Rejeite se o carimbo tiver mais de 5 minutos. Desduplique por `event.id` (entrega pelo menos uma vez).

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

## Transações

Uma **transação** é um pedido API de entrada bem-sucedido (HTTP 2xx). Webhooks, tentativas e falhas não são contados.

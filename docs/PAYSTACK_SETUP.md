# Paystack setup (membership billing)

## Dashboard

1. Create a **monthly plan** per currency (USD-equivalent pricing):
   - NGN — ₦3,200/mo
   - GHS — GH₵30/mo
   - KES — KSh 260/mo
   - ZAR — R 36/mo
2. Copy each **plan code** (e.g. `PLN_xxx`).

## Webhook

URL: `https://<project-ref>.supabase.co/functions/v1/paystack-webhook`

Events: `charge.success`, `subscription.create`, `subscription.disable`, `subscription.not_renew`, `invoice.update`, `invoice.payment_failed`

## Supabase secrets

```
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_WEBHOOK_SECRET=...   # optional; falls back to secret key
PAYSTACK_PLAN_CODE_NGN=PLN_...
PAYSTACK_PLAN_CODE_GHS=PLN_...
PAYSTACK_PLAN_CODE_KES=PLN_...
PAYSTACK_PLAN_CODE_ZAR=PLN_...
```

## Frontend env

```
VITE_PAYSTACK_PUBLIC_KEY=pk_test_...
```

## Migration

```bash
npx supabase db push
```

Applies `20260622100000_payment_provider_paystack.sql`.

## E2E checks

- Join/Onboarding/Upgrade → pick Paystack + NGN → popup → `payment_provider = paystack`
- Pick Stripe → Elements → `payment_provider = stripe`
- Billing shows locked provider; Paystack members get manage link
- Existing Stripe rows backfilled via migration

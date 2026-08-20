# Legacy per-application payment (archived)

**Archived:** May 2026  
**Replaced by:** Full Member membership on `/join` — only active `member` tier users can submit applications.

## What this did

- Sitewide fee from `platform_settings.application_fee`
- On submit, `submit-application` set status `pending_payment` and returned Stripe Checkout URL
- `create-checkout-session` edge function created sessions
- Frontend: `PaymentStep`, `/payment/success`, `/payment/cancel`

## Contents

- `frontend/` — React payment UI and hooks
- `edge-functions/create-checkout-session/` — Stripe Checkout for application fees
- `edge-functions/submit-application-payment-block.ts` — Extracted fee/checkout logic from `submit-application`

## Restore (if needed)

1. Copy edge functions back to `supabase/functions/`
2. Re-wire payment routes in `App.tsx`
3. Re-import `PaymentStep` in application form
4. Restore fee branch in `submit-application` from `submit-application-payment-block.ts`
5. Set `platform_settings.application_fee` > 0

## Refunds

Cancelled `pending_payment` applications (membership migration) may have paid via Stripe — process refunds manually in Stripe Dashboard.

# Paystack manage billing link (archived)

**Archived:** June 2026  
**Reason:** Required reliable `SUB_*` subscription in Paystack; cancel/resume in-app covers lifecycle.

## What it did

- Edge fn `create-paystack-manage-link` → Paystack `GET /subscription/:code/manage/link/`
- UI button "Manage Paystack billing" on membership profile

## Restore

1. Copy `edge-functions/create-paystack-manage-link/` → `supabase/functions/`
2. Add `[functions.create-paystack-manage-link]` `verify_jwt = false` in `config.toml`
3. Re-wire button in `MembershipProfileSection.tsx`
4. `npx supabase functions deploy create-paystack-manage-link`

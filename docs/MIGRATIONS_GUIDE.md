# Migrations Guide

## Naming

`supabase/migrations/YYYYMMDDHHMMSS_snake_case_description.sql`

- Timestamp must be **later than the last migration already applied on the remote**. Check with `supabase migration list --db-url "$DB_URL"`.
- Description says what changes, not why: `add_phone_number_to_profiles`, `fix_activity_logs_insert_spoofing`.
- Never rename or edit a migration that has been applied. Write a new one.

## Rules

- **Idempotent.** `CREATE OR REPLACE FUNCTION`, `IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`. Migrations get re-run in fresh envs and CI.
- **One concern per file.** Easier to review and to reason about when a push half-fails.
- **Header comment** explaining the problem being fixed. Every existing migration does this — keep it.
- **Functions:** `SECURITY DEFINER` needs `SET search_path = public`, plus `REVOKE ALL ... FROM PUBLIC, anon, authenticated` and an explicit `GRANT EXECUTE` to the roles that need it. Postgres grants EXECUTE to PUBLIC by default.
- **`pg_cron`:** unschedule by `jobid`, never by name — `cron.unschedule(name)` raises `XX000` / `permission denied for table job` on self-hosted. Wrap both unschedule and schedule in `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE NOTICE`, or a cron permission quirk aborts the whole push.
- **Vault-dependent SQL:** guard on `EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = ...)` and `RAISE NOTICE` when skipping.
- **RLS:** wrap `auth.uid()` as `(select auth.uid())` in policies to avoid per-row re-evaluation.

## Applying

```bash
./scripts/deploy-selfhosted.sh          # pushes migrations
```

`--include-all` is **off by default** and gated behind `INCLUDE_ALL_MIGRATIONS=1`. If a push fails as out-of-order, the fix is to renumber your unapplied migration past the remote's head — not to set the flag. The flag can apply migrations out of dependency order.

## Checklist

- [ ] Timestamp after remote head
- [ ] Re-runnable
- [ ] Header comment
- [ ] Grants explicit on new functions
- [ ] Cron/vault blocks guarded
- [ ] Pushed to staging before prod

# Auth Email Hook Deployment Status

## ✅ Functions Deployed Successfully

Both email Edge Functions have been deployed:

### 1. `auth-email-hook` (Supabase Auth Integration)
- Intercepts Supabase auth emails (password reset, email verification, magic links)
- Sends branded emails via Resend

### 2. `send-email` (Application Emails)
- Sends application-related emails (submitted, approved, rejected, etc.)
- Called from frontend code via `supabase.functions.invoke()`

## 🔐 Required Secrets

| Secret | Status | Purpose |
|--------|--------|---------|
| `RESEND_API_KEY` | ✅ Configured | Resend API key for sending emails |
| `FROM_EMAIL` | ⚠️ Optional | Custom from address (e.g., `Maali <noreply@yourdomain.com>`) |

> **Note:** Without `FROM_EMAIL`, emails will be sent from `onboarding@resend.dev` which only works for testing.

### To use a custom domain:
1. Verify your domain at https://resend.com/domains
2. Add the `FROM_EMAIL` secret with format: `Your App <noreply@yourdomain.com>`

## 🔗 Enable Auth Hook in Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/alpudhhsmgtpmgpjfuqs/auth/templates
2. Scroll to **Auth Hooks** section
3. Enable **Send Email Hook**
4. Enter hook URL:
   ```
   https://alpudhhsmgtpmgpjfuqs.supabase.co/functions/v1/auth-email-hook
   ```
5. Click **Save**

## ✅ Verification

Test the setup:

1. **Password Reset:** Click "Forgot password" and check email
2. **Email Verification:** Sign up and verify the confirmation email

## 📝 Email Types Supported

### Auth Hook (`auth-email-hook`)
- `password_reset` - Password reset requests
- `signup` - Email verification
- `magiclink` - Magic link sign-in
- `email_change` - Email change confirmations

### Application Emails (`send-email`)
- `application_submitted` - Submission confirmation
- `application_approved` - Approval notification
- `application_rejected` - Rejection notification
- `application_under_review` - Review status update
- `status_update` - Generic status updates
- `welcome` - Welcome email for new users

## 🐛 Troubleshooting

Check function logs in Lovable or via CLI:
```bash
npx supabase functions logs auth-email-hook --project-ref alpudhhsmgtpmgpjfuqs
npx supabase functions logs send-email --project-ref alpudhhsmgtpmgpjfuqs
```


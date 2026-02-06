# Auth Email Hook Deployment Status

## ✅ Function Deployed Successfully

The `auth-email-hook` Edge Function has been deployed to your Supabase project:
- **Project**: maalidev (alpudhhsmgtpmgpjfuqs)
- **Function**: auth-email-hook
- **Status**: Deployed
- **Dashboard**: https://supabase.com/dashboard/project/alpudhhsmgtpmgpjfuqs/functions

## 🔐 Required Secrets

You need to set the following secrets in your Supabase project for the function to work:

### 1. Set Secrets via CLI

```bash
# Set Resend API Key (get from https://resend.com/api-keys)
npx supabase secrets set RESEND_API_KEY=your_resend_api_key --project-ref alpudhhsmgtpmgpjfuqs

# Set Supabase Service Role Key (get from Project Settings → API → service_role key)
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key --project-ref alpudhhsmgtpmgpjfuqs

# Set Site URL (your production domain)
npx supabase secrets set SITE_URL=https://yourdomain.com --project-ref alpudhhsmgtpmgpjfuqs
```

### 2. Or Set via Dashboard

1. Go to https://supabase.com/dashboard/project/alpudhhsmgtpmgpjfuqs/settings/functions
2. Navigate to **Secrets** section
3. Add each secret:
   - `RESEND_API_KEY` - Your Resend API key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service_role key (from Project Settings → API)
   - `SITE_URL` - Your production URL (e.g., `https://yourdomain.com`)

## 🔗 Enable Email Hook in Dashboard

After setting the secrets, enable the email hook:

1. Go to https://supabase.com/dashboard/project/alpudhhsmgtpmgpjfuqs/auth/templates
2. Scroll down to **Auth Hooks** section
3. Enable **Send Email Hook**
4. Enter the hook URL:
   ```
   https://alpudhhsmgtpmgpjfuqs.supabase.co/functions/v1/auth-email-hook
   ```
5. Click **Save**

## ✅ Verification

Once configured, test the hook:

1. **Test Password Reset**:
   - Go to your auth page
   - Click "Forgot password?"
   - Enter an email address
   - Check your email - it should use your custom template

2. **Test Email Verification**:
   - Sign up a new user
   - Check the verification email - it should use your custom template

## 📝 Notes

- The hook handles: password reset, email verification, magic link, and email change emails
- Recipient names are fetched from `user_metadata` or `profiles` table
- If name is not available, it defaults to "User"
- All emails use your custom Resend templates with Maali branding

## 🐛 Troubleshooting

If emails aren't sending:

1. Check function logs:
   ```bash
   npx supabase functions logs auth-email-hook --project-ref alpudhhsmgtpmgpjfuqs
   ```

2. Verify secrets are set:
   - Go to Dashboard → Settings → Functions → Secrets
   - Ensure all three secrets are present

3. Check Resend dashboard for delivery status

4. Verify hook URL is correct in Auth settings


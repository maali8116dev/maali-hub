# Supabase Email Hook Setup Guide

This guide explains how to configure Supabase email hooks to use your custom email templates for authentication emails (password reset, email verification, etc.).

## Overview

The `auth-email-hook` Edge Function intercepts Supabase's authentication emails and sends them using your custom Resend templates instead of Supabase's default templates.

## Prerequisites

1. **Resend API Key**: Ensure `RESEND_API_KEY` is set in your Supabase project secrets
2. **Supabase Service Role Key**: Required for fetching user profile data
3. **Site URL**: Set `SITE_URL` environment variable (or it defaults to `http://localhost:5173`)

## Deployment Steps

### 1. Deploy the Edge Function

```bash
# Deploy the auth-email-hook function
supabase functions deploy auth-email-hook

# Set required secrets
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set SITE_URL=https://yourdomain.com
```

### 2. Configure in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings** → **Auth** → **Email Templates**
3. Scroll down to **Auth Hooks** section
4. Enable **Send Email Hook**
5. Enter your hook URL:
   ```
   https://[your-project-ref].supabase.co/functions/v1/auth-email-hook
   ```
   Replace `[your-project-ref]` with your actual project reference ID.

### 3. Verify Configuration

After enabling the hook:

1. **Test Password Reset**:
   - Go to your auth page
   - Click "Forgot password?"
   - Enter an email address
   - Check that the email uses your custom template

2. **Test Email Verification**:
   - Sign up a new user
   - Check that the verification email uses your custom template

## How It Works

1. When a user requests a password reset (or other auth action), Supabase:
   - Generates the token
   - Calls your `auth-email-hook` Edge Function with user and email data
   - Waits for a 200 response

2. Your Edge Function:
   - Receives the payload with user info and email data
   - Fetches recipient name from `user_metadata` or `profiles` table
   - Generates custom HTML email using your templates
   - Sends email via Resend
   - Returns 200 status to Supabase

## Email Types Supported

The hook handles these Supabase auth email types:

- `password_reset` - Password reset requests
- `signup` - Email verification for new signups
- `magiclink` - Magic link sign-in
- `email_change` - Email address change confirmation
- `email_change_token_new` - New email confirmation
- `email_change_token_current` - Current email confirmation

## Recipient Name Resolution

The function tries to get the recipient name in this order:

1. From `user.user_metadata.first_name` and `user.user_metadata.last_name`
2. From `profiles` table (fetched using service role key)
3. Falls back to "User" if neither is available

## Troubleshooting

### Emails not sending

1. Check Edge Function logs:
   ```bash
   supabase functions logs auth-email-hook
   ```

2. Verify secrets are set:
   ```bash
   supabase secrets list
   ```

3. Check Resend dashboard for delivery status

### Wrong recipient name

- Ensure `user_metadata` is populated during signup, OR
- Ensure profiles table has `first_name` and `last_name` for the user

### Hook not being called

- Verify the hook URL is correct in Supabase dashboard
- Check that "Send Email Hook" is enabled
- Ensure the function is deployed and accessible

## Important Notes

- **When both Email Provider and Auth Hook are enabled**: The Auth Hook handles ALL email sending - SMTP is bypassed
- **Error Handling**: The function returns 200 even on errors to prevent infinite retries. Check logs for actual errors
- **Token Handling**: Supabase handles token generation and validation. The hook only customizes the email content
- **Redirect URLs**: The hook uses `redirect_to` from Supabase or falls back to `SITE_URL` environment variable

## Local Development

For local development, you can test the hook using:

```bash
# Start Supabase locally
supabase start

# Serve the function locally
supabase functions serve auth-email-hook

# The hook URL will be:
# http://localhost:54321/functions/v1/auth-email-hook
```

Note: You'll need to configure this URL in your local Supabase instance's auth settings.


# Stripe Payment Integration Setup

This document outlines the Stripe payment integration implementation for the Maali Opportunity Hub application.

## Overview

Stripe payment processing has been fully integrated into the application form submission flow. Users are required to pay application fees (if applicable) before submitting their applications.

## Components Created

### 1. Stripe Configuration (`src/lib/stripe.ts`)
- Stripe client initialization
- Amount formatting utilities (to/from cents)

### 2. Edge Functions

#### `create-payment-intent` (`supabase/functions/create-payment-intent/index.ts`)
- Creates Stripe payment intents
- Creates transaction records in the database
- Returns client secret for frontend payment form

#### `stripe-webhook` (`supabase/functions/stripe-webhook/index.ts`)
- Handles Stripe webhook events
- Updates transaction status
- Updates application payment status

### 3. React Components

#### `PaymentForm` (`src/components/payment/PaymentForm.tsx`)
- Stripe Elements payment form
- Handles payment confirmation
- Shows payment status messages

#### `StripeElementsProvider` (`src/components/payment/StripeElementsProvider.tsx`)
- Wraps payment form with Stripe Elements provider
- Configures Stripe appearance to match app theme

#### `PaymentStep` (`src/components/application/PaymentStep.tsx`)
- Payment step component for application form
- Fetches project application fee
- Conditionally shows payment form or skip message

### 4. Hooks

#### `usePayment` (`src/hooks/usePayment.ts`)
- `useCreatePaymentIntent`: Creates payment intent via Edge Function
- `useConfirmPayment`: Confirms payment with Stripe

## Integration Points

### Application Form
- Payment step added as Step 6 (before Review & Submit)
- Payment validation before submission
- Payment status tracked in form store

### Database
- Transactions table stores all payment records
- Applications table tracks payment status (`application_fee_paid`, `stripe_payment_intent_id`)

## Environment Variables Required

Add these to your Supabase project secrets:

```bash
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_... # Your Stripe webhook signing secret
```

Add to your frontend `.env`:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... # Your Stripe publishable key
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install @stripe/stripe-js stripe @stripe/react-stripe-js
```

### 2. Configure Stripe Keys
1. Get your Stripe API keys from https://dashboard.stripe.com/apikeys
2. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to Supabase secrets
3. Add `VITE_STRIPE_PUBLISHABLE_KEY` to your frontend `.env` file

### 3. Deploy Edge Functions
```bash
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
```

### 4. Configure Stripe Webhook
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
4. Copy the webhook signing secret and add it to Supabase secrets as `STRIPE_WEBHOOK_SECRET`

### 5. Test Payment Flow
1. Create a project with an application fee
2. Start an application
3. Complete all form steps
4. On payment step, use Stripe test card: `4242 4242 4242 4242`
5. Complete payment and verify transaction is created

## Payment Flow

1. User completes application form steps 1-5
2. On step 6 (Payment):
   - System checks if project has application fee
   - If fee exists, creates payment intent
   - Shows Stripe payment form
   - User completes payment
3. On step 7 (Review & Submit):
   - System validates payment was completed (if required)
   - User reviews and submits application
4. Webhook updates transaction and application status

## Database Schema

### Transactions Table
- Stores all payment transactions
- Links to applications and projects
- Tracks payment status and provider details

### Applications Table
- `application_fee_paid`: Boolean flag
- `stripe_payment_intent_id`: Stripe payment intent ID

## Security Considerations

1. **Never expose secret keys**: Only publishable key in frontend
2. **Webhook verification**: All webhooks are verified using signing secret
3. **RLS policies**: Transactions are protected by Row Level Security
4. **Payment validation**: Payment status is verified before application submission

## Testing

### Test Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

### Test Mode
- Use test API keys for development
- Switch to live keys for production

## Troubleshooting

### Payment Intent Creation Fails
- Check Stripe secret key is set correctly
- Verify Edge Function has access to secrets
- Check Supabase function logs

### Webhook Not Receiving Events
- Verify webhook URL is correct
- Check webhook signing secret matches
- Ensure events are selected in Stripe dashboard

### Payment Not Updating Application
- Check webhook is processing events
- Verify transaction update logic
- Check application update query

## Next Steps

1. Update Billing page to fetch real payment methods and transactions
2. Add admin RLS policies for transaction access
3. Implement payment method management
4. Add refund functionality
5. Add invoice generation


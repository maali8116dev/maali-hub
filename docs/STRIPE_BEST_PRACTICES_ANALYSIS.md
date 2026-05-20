# Stripe Implementation Best Practices Analysis

## ✅ **What You're Doing Well**

### 1. **Webhook Security** ✅

- ✅ Signature verification using `stripe.webhooks.constructEventAsync()`
- ✅ Webhook secret stored in environment variables
- ✅ Proper error handling for invalid signatures

### 2. **Idempotency Checks** ✅

- ✅ Checking `application_fee_paid` before processing (line 138-148)
- ✅ Checking transaction status before updating (line 206-229)
- ✅ Checking reviewer assignments before assigning (line 532-542)
- ✅ Email queue uses `idempotency_key` (line 702)

### 3. **Transaction Records** ✅

- ✅ Creating transaction records before payment
- ✅ Updating transaction status after payment
- ✅ Storing Stripe IDs for reconciliation

### 4. **Error Handling** ✅

- ✅ Try-catch blocks around critical operations
- ✅ Non-blocking failures (PDF generation, notifications)
- ✅ Proper error logging

### 5. **Payment Method** ✅

- ✅ Using Checkout Sessions (Stripe's recommended approach)
- ✅ Proper metadata storage for tracking

---

## ⚠️ **Areas for Improvement**

### 1. **Missing Webhook Event Deduplication** ❌ **CRITICAL**

**Problem**: Stripe can send duplicate webhook events. Your current implementation doesn't track `event.id` to prevent duplicate processing.

**Current Code**:

```typescript
// Line 47-75: No event.id tracking
switch (event.type) {
  case "checkout.session.completed": {
    await handleCheckoutCompleted(session);
    break;
  }
}
```

**Risk**: If Stripe retries a webhook (network issues, 500 errors), you could:

- Process the same payment twice
- Send duplicate emails
- Assign reviewers multiple times
- Create duplicate notifications

**Best Practice Solution**:

```typescript
// Track processed events in database
const { data: existingEvent } = await supabaseAdmin
  .from("webhook_events")
  .select("id")
  .eq("stripe_event_id", event.id)
  .maybeSingle();

if (existingEvent) {
  console.log(`Event ${event.id} already processed, skipping`);
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

// Process event...

// Record event as processed
await supabaseAdmin.from("webhook_events").insert({
  stripe_event_id: event.id,
  event_type: event.type,
  processed_at: new Date().toISOString(),
  metadata: { applicationId, userId },
});
```

**Impact**: **HIGH** - Prevents duplicate processing and data inconsistencies

---

### 2. **Redundant Event Handlers** ⚠️ **MODERATE**

**Problem**: You're handling both `checkout.session.completed` AND `payment_intent.succeeded`. When a Checkout Session completes, Stripe fires BOTH events, causing duplicate processing attempts.

**Current Code**:

```typescript
case "checkout.session.completed": {
  await handleCheckoutCompleted(session);  // Processes payment
  break;
}

case "payment_intent.succeeded": {
  await handlePaymentSuccess(paymentIntent);  // Also processes payment
  break;
}
```

**What Happens**:

1. User completes checkout → `checkout.session.completed` fires
2. Stripe also fires `payment_intent.succeeded` (same payment)
3. Both handlers run (though idempotency prevents double-processing)

**Best Practice**:

- **Option A**: Only handle `checkout.session.completed` (recommended for Checkout Sessions)
- **Option B**: Handle `payment_intent.succeeded` only if metadata is missing from checkout session
- **Option C**: Use event deduplication table (see #1)

**Impact**: **MODERATE** - Wastes resources, potential race conditions

---

### 3. **Transaction Insert Error Handling** ⚠️ **MODERATE**

**Problem**: Transaction insert failures are logged but don't fail the request. This could lead to payments without transaction records.

**Current Code** (`submit-application/index.ts` line 250-252):

```typescript
.then(({ error }) => {
  if (error) console.error("Transaction insert error:", error);
  // ← No error handling, continues even if insert fails
});
```

**Risk**:

- Payment succeeds but no transaction record
- Can't reconcile payments
- Financial reporting incomplete

**Best Practice**:

```typescript
const { error: txError } = await supabaseAdmin
  .from("transactions")
  .insert({...});

if (txError) {
  // Rollback checkout session or handle appropriately
  await stripe.checkout.sessions.expire(session.id);
  throw new Error(`Failed to create transaction record: ${txError.message}`);
}
```

**Impact**: **MODERATE** - Could lead to orphaned payments

---

### 4. **Missing Webhook Retry Handling** ⚠️ **LOW-MODERATE**

**Problem**: If webhook processing fails (500 error), Stripe will retry. Your current error handling returns 500, which triggers retries, but you don't handle partial failures.

**Current Code** (line 81-87):

```typescript
catch (error) {
  console.error("Error processing webhook:", error);
  return new Response(
    JSON.stringify({ error: "Webhook processing failed" }),
    { status: 500 }  // ← Stripe will retry
  );
}
```

**Best Practice**:

- Return 200 for idempotent failures (already processed)
- Return 500 only for transient errors
- Log failures for manual review

**Impact**: **LOW-MODERATE** - Could cause unnecessary retries

---

### 5. **Race Condition in Dual Event Handlers** ⚠️ **MODERATE**

**Problem**: Both `checkout.session.completed` and `payment_intent.succeeded` can run simultaneously, both trying to update the same application.

**Current Mitigation**: Idempotency checks prevent double-processing, but both handlers still execute.

**Best Practice**: Use database-level locking or event deduplication (see #1)

**Impact**: **MODERATE** - Wastes resources, potential for inconsistencies

---

### 6. **Missing Webhook Event Audit Trail** ⚠️ **LOW**

**Problem**: No record of which webhook events were received and processed.

**Best Practice**: Log all webhook events (even unhandled ones) for debugging:

```typescript
await supabaseAdmin.from("webhook_events").insert({
  stripe_event_id: event.id,
  event_type: event.type,
  received_at: new Date().toISOString(),
  processed: false,
  raw_data: event, // Store full event for debugging
});
```

**Impact**: **LOW** - Makes debugging harder but doesn't affect functionality

---

### 7. **Checkout Session Expiration Not Handled** ⚠️ **LOW**

**Problem**: If a user abandons checkout, the session expires but you don't handle `checkout.session.expired` events.

**Current**: Only handles `completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`

**Best Practice**: Handle `checkout.session.expired` to clean up pending transactions:

```typescript
case "checkout.session.expired": {
  const session = event.data.object as Stripe.Checkout.Session;
  await supabaseAdmin
    .from("transactions")
    .update({ status: "cancelled" })
    .eq("provider_transaction_id", session.id)
    .eq("status", "pending");
  break;
}
```

**Impact**: **LOW** - Pending transactions remain in database but don't affect functionality

---

### 8. **Amount Validation** ✅ **GOOD**

**Current**: You validate amounts server-side in `create-payment-intent` (line 114-119)

**Good**: Prevents client-side manipulation

---

### 9. **Metadata Usage** ✅ **GOOD**

**Current**: Storing `userId`, `applicationId`, `projectId` in Stripe metadata

**Good**: Allows webhook to identify the payment without database lookups

---

## 🔴 **Critical Issues to Fix**

### Priority 1: **Webhook Event Deduplication**

- **Impact**: HIGH
- **Risk**: Duplicate processing, data corruption
- **Fix**: Create `webhook_events` table to track processed events by `event.id`

### Priority 2: **Remove Redundant Event Handler**

- **Impact**: MODERATE
- **Risk**: Wasted resources, potential race conditions
- **Fix**: Remove `payment_intent.succeeded` handler (or make it conditional)

### Priority 3: **Transaction Insert Error Handling**

- **Impact**: MODERATE
- **Risk**: Orphaned payments without records
- **Fix**: Fail checkout creation if transaction insert fails

---

## 📊 **Comparison with Stripe Best Practices**

| Best Practice                  | Your Implementation        | Status                |
| ------------------------------ | -------------------------- | --------------------- |
| Webhook signature verification | ✅ Yes                     | **GOOD**              |
| Idempotency checks             | ✅ Yes (application level) | **GOOD**              |
| Event deduplication            | ❌ No (event.id tracking)  | **NEEDS FIX**         |
| Transaction records            | ✅ Yes                     | **GOOD**              |
| Error handling                 | ✅ Yes                     | **GOOD**              |
| Amount validation              | ✅ Yes                     | **GOOD**              |
| Metadata storage               | ✅ Yes                     | **GOOD**              |
| Retry handling                 | ⚠️ Partial                 | **NEEDS IMPROVEMENT** |
| Audit trail                    | ⚠️ Partial (logs only)     | **NEEDS IMPROVEMENT** |
| Checkout Sessions              | ✅ Yes                     | **GOOD**              |
| Payment Intents                | ⚠️ Also used (redundant?)  | **REVIEW NEEDED**     |

---

## 🎯 **Recommendations**

### **Must Fix** (High Priority):

1. **Add Webhook Event Deduplication Table**

   ```sql
   CREATE TABLE webhook_events (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     stripe_event_id TEXT UNIQUE NOT NULL,
     event_type TEXT NOT NULL,
     processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     metadata JSONB,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```

2. **Remove or Conditionally Handle `payment_intent.succeeded`**

   - Only process if `checkout.session.completed` hasn't already handled it
   - Or remove entirely if using Checkout Sessions

3. **Improve Transaction Insert Error Handling**
   - Fail checkout creation if transaction insert fails
   - Or implement retry logic

### **Should Fix** (Medium Priority):

4. **Add Webhook Event Audit Trail**

   - Log all events (even unhandled)
   - Store for debugging and reconciliation

5. **Handle `checkout.session.expired` Events**
   - Clean up abandoned checkouts
   - Update transaction status

### **Nice to Have** (Low Priority):

6. **Add Webhook Retry Logic**

   - Distinguish between retryable and non-retryable errors
   - Return appropriate status codes

7. **Add Webhook Event Monitoring**
   - Alert on failed webhooks
   - Track processing times

---

## 📝 **Summary**

**Overall Assessment**: **GOOD** foundation with some critical gaps

**Strengths**:

- ✅ Security (signature verification)
- ✅ Basic idempotency
- ✅ Transaction tracking
- ✅ Error handling

**Critical Gaps**:

- ❌ No webhook event deduplication (event.id tracking)
- ⚠️ Redundant event handlers
- ⚠️ Transaction insert error handling

**Verdict**: Your implementation is **80% there** but missing the critical webhook event deduplication that Stripe strongly recommends. This is the #1 priority fix.

---

## 🔧 **Quick Wins**

1. **Add event.id check** (5 minutes) - Prevents duplicate processing
2. **Remove `payment_intent.succeeded` handler** (2 minutes) - Eliminates redundancy
3. **Add transaction insert error handling** (10 minutes) - Prevents orphaned payments

These three fixes would bring your implementation to **95% best practices**.

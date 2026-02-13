# Stripe Connect Setup — ArtigianoAI

## Overview
Stripe Connect enables artisans to receive online payments from clients and handle app subscriptions.

## Prerequisites

1. **Stripe Account**
   - Sign up at: https://stripe.com/
   - Complete business verification
   - Switch to live mode after testing

2. **Get API Keys**
   - Go to: Developers → API keys
   - Copy **Secret key**: `sk_live_...` (for production) or `sk_test_...` (for testing)
   - Copy **Publishable key**: `pk_live_...` (for client-side)
   - Copy **Webhook secret**: `whsec_...` (for webhooks)

## Supabase Secrets Configuration

Set required secrets in Supabase:
```bash
# Stripe API keys
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (create these in Stripe Dashboard first)
supabase secrets set STRIPE_PRICE_STARTER=price_...
supabase secrets set STRIPE_PRICE_PRO=price_...
supabase secrets set STRIPE_PRICE_BUSINESS=price_...
```

## Stripe Dashboard Setup

### 1. Create Products & Prices

Go to: Products → Add product

**Starter Plan:**
- Name: ArtigianoAI Starter
- Description: Basic plan for contractors
- Price: €19.00 EUR / month recurring
- Copy Price ID → `STRIPE_PRICE_STARTER`

**Pro Plan:**
- Name: ArtigianoAI Pro
- Description: Pro features with AI Inbox
- Price: €29.00 EUR / month recurring
- Copy Price ID → `STRIPE_PRICE_PRO`

**Business Plan:**
- Name: ArtigianoAI Business
- Description: Full features with Marketplace
- Price: €49.00 EUR / month recurring
- Copy Price ID → `STRIPE_PRICE_BUSINESS`

### 2. Enable Stripe Connect

Go to: Settings → Connect

- Enable: **Express accounts**
- Platform profile: Fill out company info
- Branding: Upload logo

### 3. Configure Webhook

Go to: Developers → Webhooks → Add endpoint

**Endpoint URL:**
```
https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/stripe-webhook
```

**Events to listen for:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `account.updated`

**Webhook secret:**
Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

## Database Migration

Apply the migration to add Stripe fields:
```bash
supabase migration up 20260213000001_add_stripe_fields
```

Or apply manually:
```sql
ALTER TABLE artisans ADD COLUMN stripe_account_id TEXT;
ALTER TABLE artisans ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE artisans ADD COLUMN subscription_plan TEXT DEFAULT 'starter';
ALTER TABLE artisans ADD COLUMN subscription_status TEXT DEFAULT 'active';

ALTER TABLE invoices_active ADD COLUMN stripe_payment_link TEXT;
ALTER TABLE invoices_active ADD COLUMN stripe_payment_intent_id TEXT;
```

## Edge Functions Deployment

Deploy all Stripe-related functions:
```bash
supabase functions deploy create-stripe-account
supabase functions deploy create-payment-link
supabase functions deploy create-subscription
supabase functions deploy stripe-webhook
```

## Testing

### Test Create Stripe Account
```bash
curl -X POST https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/create-stripe-account \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "artisanId": "...",
    "email": "test@example.com",
    "businessName": "Test Business",
    "country": "IT"
  }'
```

### Test Create Payment Link
```bash
curl -X POST https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/create-payment-link \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"invoiceId": "..."}'
```

### Test Webhook (locally)
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
stripe trigger payment_intent.succeeded
```

## Client Integration

### 1. Connect Stripe Account

In `app/(tabs)/settings/billing.tsx`, add Stripe Connect section:

```typescript
const handleConnectStripe = async () => {
  const { data } = await supabase.functions.invoke('create-stripe-account', {
    body: {
      artisanId: artisan.id,
      email: artisan.email,
      businessName: artisan.business_name,
      country: artisan.country_code || 'IT',
    },
  });

  // Open onboarding URL
  await Linking.openURL(data.onboardingUrl);
};
```

### 2. Create Payment Link for Invoice

In `app/(tabs)/invoices/active/[id].tsx`:

```typescript
const handleCreatePaymentLink = async () => {
  const { data } = await supabase.functions.invoke('create-payment-link', {
    body: { invoiceId: invoice.id },
  });

  // Share payment link
  const message = `Paga la tua fattura: ${data.paymentLink}`;
  await Share.share({ message });
};
```

### 3. Upgrade Subscription

In `app/(tabs)/settings/billing.tsx`:

```typescript
const handleUpgrade = async (plan: 'starter' | 'pro' | 'business') => {
  const { data } = await supabase.functions.invoke('create-subscription', {
    body: {
      artisanId: artisan.id,
      plan,
      email: artisan.email,
    },
  });

  // Open Stripe Checkout
  await Linking.openURL(data.checkoutUrl);
};
```

## Security Considerations

1. **API Keys:**
   - NEVER commit API keys to git
   - Use environment variables only
   - Rotate keys if compromised

2. **Webhook Signatures:**
   - Always verify webhook signatures
   - Reject unsigned requests

3. **User Permissions:**
   - Validate artisan ownership before operations
   - Use RLS policies on database

4. **PCI Compliance:**
   - Stripe handles card data (PCI compliant)
   - Never store card numbers

## Costs & Fees

### Stripe Connect
- **Per transaction:** 2.9% + €0.25
- **Platform fee (optional):** We charge 2.9% on top
- **Payout schedule:** Rolling 2-day basis (configurable)

### Subscriptions
- **Same fees:** 2.9% + €0.25 per renewal
- **No monthly fees** for platform

### Refunds
- **Full refund:** Stripe fees returned
- **Partial refund:** Prorated fees

## Troubleshooting

### Webhook not receiving events
1. Check endpoint URL is correct
2. Verify webhook secret matches
3. Check Supabase Edge Function logs
4. Test with `stripe trigger` CLI

### Account onboarding stuck
1. Check Stripe Dashboard → Connect → Accounts
2. See account status and missing requirements
3. Re-generate onboarding link

### Payment link not working
1. Verify Stripe account fully onboarded
2. Check account has charges_enabled
3. Verify transfer_data destination is correct

## Resources

- Stripe Connect Docs: https://stripe.com/docs/connect
- Payment Links: https://stripe.com/docs/payment-links
- Subscriptions: https://stripe.com/docs/billing/subscriptions
- Webhooks: https://stripe.com/docs/webhooks

---

**Last Updated:** February 13, 2026
**Version:** 1.0

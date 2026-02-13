-- Add Stripe fields to artisans table for Connect integration
ALTER TABLE artisans ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE artisans ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE artisans ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'starter';
ALTER TABLE artisans ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';

-- Add Stripe fields to invoices_active table for payment tracking
ALTER TABLE invoices_active ADD COLUMN IF NOT EXISTS stripe_payment_link TEXT;
ALTER TABLE invoices_active ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Create index for faster Stripe account lookups
CREATE INDEX IF NOT EXISTS idx_artisans_stripe_account_id ON artisans(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_active_stripe_payment_intent ON invoices_active(stripe_payment_intent_id);

-- Comment fields
COMMENT ON COLUMN artisans.stripe_account_id IS 'Stripe Connect Express account ID for receiving payments';
COMMENT ON COLUMN artisans.stripe_customer_id IS 'Stripe Customer ID for app subscriptions';
COMMENT ON COLUMN artisans.subscription_plan IS 'App subscription plan: starter, pro, business';
COMMENT ON COLUMN artisans.subscription_status IS 'Subscription status: active, past_due, canceled';
COMMENT ON COLUMN invoices_active.stripe_payment_link IS 'Stripe Payment Link URL for client payment';
COMMENT ON COLUMN invoices_active.stripe_payment_intent_id IS 'Stripe Payment Intent ID for tracking';

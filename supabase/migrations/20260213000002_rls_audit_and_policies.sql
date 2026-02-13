-- ============================================================================
-- RLS AUDIT AND COMPLETE POLICIES
-- ============================================================================
-- This migration ensures all tables have proper Row Level Security enabled
-- and comprehensive policies for data isolation between artisans
-- ============================================================================

-- Enable RLS on all tables (idempotent)
ALTER TABLE artisans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_active ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_passive ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ARTISANS TABLE
-- ============================================================================

-- Drop existing policies to recreate fresh
DROP POLICY IF EXISTS "Users can view their own artisan profile" ON artisans;
DROP POLICY IF EXISTS "Users can update their own artisan profile" ON artisans;
DROP POLICY IF EXISTS "Users can insert their own artisan profile" ON artisans;

-- Artisan can only access their own profile
CREATE POLICY "artisans_select_own"
  ON artisans FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "artisans_update_own"
  ON artisans FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "artisans_insert_own"
  ON artisans FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No delete policy (soft delete or admin only)

-- ============================================================================
-- CLIENTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can access their own clients" ON clients;

CREATE POLICY "clients_all_own"
  ON clients FOR ALL
  USING (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- JOBS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can access their own jobs" ON jobs;

CREATE POLICY "jobs_all_own"
  ON jobs FOR ALL
  USING (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can access their own quotes" ON quotes;
DROP POLICY IF EXISTS "Public quote acceptance" ON quotes;

-- Artisan can manage their own quotes
CREATE POLICY "quotes_all_own"
  ON quotes FOR ALL
  USING (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  );

-- Public can view sent quotes for acceptance (without auth)
CREATE POLICY "quotes_public_view_sent"
  ON quotes FOR SELECT
  USING (status = 'sent');

-- Public can update sent quotes to accepted (for deep link acceptance)
CREATE POLICY "quotes_public_accept"
  ON quotes FOR UPDATE
  USING (status = 'sent')
  WITH CHECK (status IN ('accepted', 'rejected'));

-- ============================================================================
-- INVOICES_ACTIVE TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can access their own active invoices" ON invoices_active;

CREATE POLICY "invoices_active_all_own"
  ON invoices_active FOR ALL
  USING (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- INVOICES_PASSIVE TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can access their own passive invoices" ON invoices_passive;

CREATE POLICY "invoices_passive_all_own"
  ON invoices_passive FOR ALL
  USING (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- PRICE_LIST TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can access their own price list" ON price_list;

CREATE POLICY "price_list_all_own"
  ON price_list FOR ALL
  USING (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- QUOTE_TEMPLATES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can access their own templates" ON quote_templates;

CREATE POLICY "quote_templates_all_own"
  ON quote_templates FOR ALL
  USING (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- AI_PATTERNS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can access their own ai patterns" ON ai_patterns;

CREATE POLICY "ai_patterns_all_own"
  ON ai_patterns FOR ALL
  USING (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- INBOX_ITEMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can access their own inbox items" ON inbox_items;

CREATE POLICY "inbox_items_all_own"
  ON inbox_items FOR ALL
  USING (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this to verify all tables have RLS enabled:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND rowsecurity = false;
-- Should return 0 rows!

-- Run this to list all policies:
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

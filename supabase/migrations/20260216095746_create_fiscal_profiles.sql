-- ============================================
-- Fiscal Compliance: Create fiscal_profiles & fiscal_year_tracking
-- ============================================

-- Fiscal profile per artisan (regime, SdI provider, etc.)
CREATE TABLE fiscal_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  regime TEXT NOT NULL DEFAULT 'ordinario', -- ordinario, forfettario, minimi
  coefficient NUMERIC, -- coefficiente di redditività forfettario
  annual_revenue_limit NUMERIC DEFAULT 85000.00,
  sdi_provider TEXT, -- fatture_in_cloud, aruba, fattura24
  sdi_provider_api_key_encrypted TEXT,
  sdi_code TEXT DEFAULT '0000000',
  pec_address TEXT,
  digital_stamp_enabled BOOLEAN DEFAULT TRUE,
  reverse_charge_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fiscal_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own fiscal profile"
ON fiscal_profiles FOR ALL
USING (artisan_id IN (
  SELECT id FROM artisans WHERE user_id = auth.uid()
));

-- Fiscal year tracking (revenue/expense per year for forfettario threshold)
CREATE TABLE fiscal_year_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_revenue NUMERIC DEFAULT 0,
  total_expenses NUMERIC DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fiscal_year_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own fiscal year tracking"
ON fiscal_year_tracking FOR ALL
USING (artisan_id IN (
  SELECT id FROM artisans WHERE user_id = auth.uid()
));

-- Unique constraint: one row per artisan per year
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_year_tracking_artisan_year
ON fiscal_year_tracking (artisan_id, year);

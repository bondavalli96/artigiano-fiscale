-- ============================================
-- ArtigianoAI - Initial Database Schema
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. Profilo artigiano
-- ============================================
CREATE TABLE artisans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  trade TEXT NOT NULL,
  fiscal_code TEXT,
  vat_number TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  preferred_input TEXT DEFAULT 'text',
  sdi_code TEXT DEFAULT '0000000',
  expo_push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE artisans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own artisan profile"
ON artisans FOR ALL
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own artisan profile"
ON artisans FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ============================================
-- 2. Listino prezzi personalizzato
-- ============================================
CREATE TABLE price_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit TEXT DEFAULT 'ore',
  default_price NUMERIC(10,2),
  category TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE price_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own price list"
ON price_list FOR ALL
USING (artisan_id IN (
  SELECT id FROM artisans WHERE user_id = auth.uid()
));

-- ============================================
-- 3. Clienti
-- ============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  reliability_score INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own clients"
ON clients FOR ALL
USING (artisan_id IN (
  SELECT id FROM artisans WHERE user_id = auth.uid()
));

-- ============================================
-- 4. Lavori
-- ============================================
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  title TEXT NOT NULL,
  description TEXT,
  raw_voice_url TEXT,
  transcription TEXT,
  photos TEXT[],
  ai_extracted_data JSONB,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own jobs"
ON jobs FOR ALL
USING (artisan_id IN (
  SELECT id FROM artisans WHERE user_id = auth.uid()
));

-- ============================================
-- 5. Preventivi
-- ============================================
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  quote_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  items JSONB NOT NULL,
  subtotal NUMERIC(10,2),
  vat_rate NUMERIC(4,2) DEFAULT 22.00,
  vat_amount NUMERIC(10,2),
  total NUMERIC(10,2),
  notes TEXT,
  valid_until DATE,
  accepted_at TIMESTAMPTZ,
  pdf_url TEXT,
  sent_via TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own quotes"
ON quotes FOR ALL
USING (artisan_id IN (
  SELECT id FROM artisans WHERE user_id = auth.uid()
));

-- Quote accept: allow anyone to read quotes by ID (for public accept link)
CREATE POLICY "Anyone can read quotes by id"
ON quotes FOR SELECT
USING (true);

-- ============================================
-- 6. Fatture attive (emesse)
-- ============================================
CREATE TABLE invoices_active (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  items JSONB NOT NULL,
  subtotal NUMERIC(10,2),
  vat_rate NUMERIC(4,2) DEFAULT 22.00,
  vat_amount NUMERIC(10,2),
  total NUMERIC(10,2),
  payment_due DATE,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  reminders_sent INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoices_active ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own active invoices"
ON invoices_active FOR ALL
USING (artisan_id IN (
  SELECT id FROM artisans WHERE user_id = auth.uid()
));

-- ============================================
-- 7. Fatture passive (ricevute / costi)
-- ============================================
CREATE TABLE invoices_passive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  supplier_name TEXT,
  invoice_number TEXT,
  category TEXT,
  subtotal NUMERIC(10,2),
  vat_amount NUMERIC(10,2),
  total NUMERIC(10,2),
  issue_date DATE,
  payment_due DATE,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  original_file_url TEXT,
  ai_extracted_data JSONB,
  ai_flags JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoices_passive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own passive invoices"
ON invoices_passive FOR ALL
USING (artisan_id IN (
  SELECT id FROM artisans WHERE user_id = auth.uid()
));

-- ============================================
-- 8. Pattern AI (apprendimento silenzioso)
-- ============================================
CREATE TABLE ai_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  pattern_type TEXT,
  data JSONB,
  suggestion TEXT,
  accepted BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own AI patterns"
ON ai_patterns FOR ALL
USING (artisan_id IN (
  SELECT id FROM artisans WHERE user_id = auth.uid()
));

-- ============================================
-- Storage Buckets
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'recordings');

CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can upload pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pdfs');

-- Public read access for all buckets
CREATE POLICY "Public read access for recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'recordings');

CREATE POLICY "Public read access for photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

CREATE POLICY "Public read access for invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices');

CREATE POLICY "Public read access for pdfs"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdfs');

-- Business profile, invoice customization, payment settings
ALTER TABLE artisans
  ADD COLUMN IF NOT EXISTS company_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS default_vat_rate NUMERIC(4,2) DEFAULT 22.00,
  ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '{"bank_transfer": true, "card": false, "stripe_link": false, "other": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS stripe_payment_link TEXT,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_features JSONB DEFAULT '["Preventivi", "Fatture", "Agenda"]'::jsonb,
  ADD COLUMN IF NOT EXISTS invoice_template_key TEXT DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS invoice_template_file_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_field_visibility JSONB DEFAULT '{
    "quantity": true,
    "unit": true,
    "article_code": false,
    "discount": false,
    "vat_column": true,
    "due_date": true,
    "payment_method": true,
    "notes": true,
    "signature": true
  }'::jsonb;

-- Dedicated agenda events (manual appointments)
CREATE TABLE IF NOT EXISTS agenda_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TEXT,
  location TEXT,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agenda_events'
      AND policyname = 'Users can manage own agenda events'
  ) THEN
    CREATE POLICY "Users can manage own agenda events"
    ON agenda_events FOR ALL
    USING (artisan_id IN (
      SELECT id FROM artisans WHERE user_id = auth.uid()
    ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agenda_events_artisan_date
  ON agenda_events(artisan_id, event_date, created_at DESC);

-- Storage bucket for signatures used in documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload signatures'
  ) THEN
    CREATE POLICY "Authenticated users can upload signatures"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'signatures');
  END IF;
END $$;

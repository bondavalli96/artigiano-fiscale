CREATE TABLE IF NOT EXISTS quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  vat_rate NUMERIC(4,2) DEFAULT 22.00,
  notes TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'manual',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "Users can only access their own templates"
ON quote_templates FOR ALL
USING (artisan_id IN (
  SELECT id FROM artisans WHERE user_id = auth.uid()
));

ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;

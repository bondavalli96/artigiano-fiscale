-- Inbox items table
CREATE TABLE inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',       -- manual | email
  source_email_from TEXT,
  source_email_subject TEXT,
  file_url TEXT,
  file_type TEXT,                              -- image | pdf | audio | document | text
  file_name TEXT,
  raw_text TEXT,
  classification TEXT,                         -- job | invoice_passive | client_info | receipt | other
  confidence NUMERIC(3,2),
  ai_extracted_data JSONB,
  ai_summary TEXT,
  status TEXT NOT NULL DEFAULT 'new',          -- new | classifying | classified | routed | error
  routed_to_table TEXT,
  routed_to_id UUID,
  user_override_classification TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  classified_at TIMESTAMPTZ,
  routed_at TIMESTAMPTZ
);

ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own inbox" ON inbox_items FOR ALL
  USING (artisan_id IN (SELECT id FROM artisans WHERE user_id = auth.uid()));

CREATE INDEX idx_inbox_artisan_status ON inbox_items(artisan_id, status, created_at DESC);

-- Email forwarding address per artisan
ALTER TABLE artisans ADD COLUMN IF NOT EXISTS inbox_email TEXT UNIQUE;

-- Storage bucket for inbox files
INSERT INTO storage.buckets (id, name, public) VALUES ('inbox', 'inbox', true) ON CONFLICT DO NOTHING;

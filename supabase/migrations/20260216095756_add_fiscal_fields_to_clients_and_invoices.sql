-- ============================================
-- Fiscal Compliance: Add fiscal fields to clients & invoices_active
-- ============================================

-- Clients: add fiscal classification fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'privato'; -- privato, azienda
ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_sector TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vat_number TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sdi_code TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pec_address TEXT;

-- Invoices Active: add fiscal/SdI fields
ALTER TABLE invoices_active ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices_active ADD COLUMN IF NOT EXISTS reverse_charge_article TEXT;
ALTER TABLE invoices_active ADD COLUMN IF NOT EXISTS digital_stamp BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices_active ADD COLUMN IF NOT EXISTS digital_stamp_amount NUMERIC DEFAULT 2.00;
ALTER TABLE invoices_active ADD COLUMN IF NOT EXISTS fiscal_notes TEXT[];
ALTER TABLE invoices_active ADD COLUMN IF NOT EXISTS sdi_status TEXT DEFAULT 'not_sent'; -- not_sent, sent, delivered, accepted, rejected
ALTER TABLE invoices_active ADD COLUMN IF NOT EXISTS sdi_id TEXT;
ALTER TABLE invoices_active ADD COLUMN IF NOT EXISTS xml_url TEXT;

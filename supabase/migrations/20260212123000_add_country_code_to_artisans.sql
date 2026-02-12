ALTER TABLE artisans
  ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'IT';

UPDATE artisans
SET country_code = 'IT'
WHERE country_code IS NULL OR country_code = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'artisans_country_code_check'
  ) THEN
    ALTER TABLE artisans
      ADD CONSTRAINT artisans_country_code_check
      CHECK (country_code IN ('IT', 'ES', 'PT'));
  END IF;
END $$;

ALTER TABLE artisans
  ALTER COLUMN country_code SET NOT NULL;

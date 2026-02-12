-- Allow anonymous users to read sent/accepted quotes (public acceptance page)
CREATE POLICY "Public can read sent quotes" ON quotes
  FOR SELECT TO anon USING (status IN ('sent', 'accepted'));

-- Allow anonymous users to accept sent quotes
CREATE POLICY "Public can accept sent quotes" ON quotes
  FOR UPDATE TO anon
  USING (status = 'sent')
  WITH CHECK (status = 'accepted');

-- Allow anonymous users to read clients linked to sent quotes (for join)
CREATE POLICY "Public can read clients via quotes" ON clients
  FOR SELECT TO anon USING (
    id IN (SELECT client_id FROM quotes WHERE status IN ('sent', 'accepted'))
  );

-- Allow anonymous users to read jobs linked to sent quotes (for join)
CREATE POLICY "Public can read jobs via quotes" ON jobs
  FOR SELECT TO anon USING (
    id IN (SELECT job_id FROM quotes WHERE status IN ('sent', 'accepted'))
  );;

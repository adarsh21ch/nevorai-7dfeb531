
-- Add private funnel columns to existing funnels table (reusing visibility='private' for is_private)
ALTER TABLE funnels
  ADD COLUMN IF NOT EXISTS access_code_plain text,
  ADD COLUMN IF NOT EXISTS required_fields jsonb DEFAULT '{"email": false, "city": false, "state": false, "whatsapp": false}';

-- Access attempt logs table
CREATE TABLE IF NOT EXISTS funnel_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  code_attempted text,
  success boolean NOT NULL DEFAULT false,
  ip_address text,
  attempted_at timestamptz DEFAULT now()
);

CREATE INDEX idx_funnel_access_logs_funnel ON funnel_access_logs(funnel_id);
CREATE INDEX idx_funnel_access_logs_attempted ON funnel_access_logs(attempted_at DESC);

ALTER TABLE funnel_access_logs ENABLE ROW LEVEL SECURITY;

-- Public can insert (log attempts)
CREATE POLICY "public_insert_access_logs" ON funnel_access_logs
  FOR INSERT WITH CHECK (true);

-- Funnel owners can view logs for their funnels
CREATE POLICY "owner_read_access_logs" ON funnel_access_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM funnels WHERE funnels.id = funnel_access_logs.funnel_id AND funnels.owner_id = auth.uid())
  );

-- Admin full access
CREATE POLICY "admin_full_access_logs" ON funnel_access_logs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

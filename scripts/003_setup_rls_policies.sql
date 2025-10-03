-- Enable RLS on all tables
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotspot_sessions ENABLE ROW LEVEL SECURITY;

-- Plans: Allow public read access to active plans
CREATE POLICY "Allow public read access to active plans"
ON plans FOR SELECT
TO public
USING (active = true);

-- Plans: Allow service role full access
CREATE POLICY "Allow service role full access to plans"
ON plans FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Payments: Allow service role full access
CREATE POLICY "Allow service role full access to payments"
ON payments FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- System Logs: Allow service role full access
CREATE POLICY "Allow service role full access to system_logs"
ON system_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Hotspot Sessions: Allow service role full access
CREATE POLICY "Allow service role full access to hotspot_sessions"
ON hotspot_sessions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Optional: Allow users to read their own payments by email
CREATE POLICY "Allow users to read their own payments"
ON payments FOR SELECT
TO public
USING (customer_email = current_setting('request.jwt.claims', true)::json->>'email');

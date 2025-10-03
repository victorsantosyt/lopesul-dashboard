-- Add payment_id column to system_logs for easier tracking
ALTER TABLE system_logs 
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE CASCADE;

-- Create index for faster log lookups by payment
CREATE INDEX IF NOT EXISTS idx_system_logs_payment_id ON system_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

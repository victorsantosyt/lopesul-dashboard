-- Add foreign key constraint for payment_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'hotspot_sessions_payment_id_fkey'
  ) THEN
    ALTER TABLE hotspot_sessions 
    ADD CONSTRAINT hotspot_sessions_payment_id_fkey 
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_hotspot_sessions_payment_id ON hotspot_sessions(payment_id);
CREATE INDEX IF NOT EXISTS idx_hotspot_sessions_status ON hotspot_sessions(status);
CREATE INDEX IF NOT EXISTS idx_hotspot_sessions_mikrotik_username ON hotspot_sessions(mikrotik_username);

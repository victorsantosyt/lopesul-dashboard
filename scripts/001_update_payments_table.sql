-- Add missing columns to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS pagar_me_order_id TEXT,
ADD COLUMN IF NOT EXISTS pagar_me_charge_id TEXT,
ADD COLUMN IF NOT EXISTS customer_document TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pix',
ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
ADD COLUMN IF NOT EXISTS pix_qr_code_url TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_payments_pagar_me_order_id ON payments(pagar_me_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_pagar_me_charge_id ON payments(pagar_me_charge_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Add foreign key constraint if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'payments_plan_id_fkey'
  ) THEN
    ALTER TABLE payments 
    ADD CONSTRAINT payments_plan_id_fkey 
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;
  END IF;
END $$;

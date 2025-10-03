-- Add pagar_me_order_id column to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS pagar_me_order_id VARCHAR(255);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(pagar_me_order_id);

-- Add comment to explain the columns
COMMENT ON COLUMN payments.pagar_me_order_id IS 'Pagar.me Order ID (or_xxx) - used to check payment status';
COMMENT ON COLUMN payments.pagar_me_transaction_id IS 'Pagar.me Transaction ID (tran_xxx) - used for QR code and transaction details';

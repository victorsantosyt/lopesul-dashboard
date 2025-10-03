-- Create all necessary tables for the payment system
-- This script creates the complete database schema

-- Create plans table
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_hours INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.plans(id),
  pagar_me_transaction_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  mikrotik_username TEXT,
  mikrotik_password TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create hotspot sessions table
CREATE TABLE IF NOT EXISTS public.hotspot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id),
  mikrotik_username TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create system logs table
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotspot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for plans (public read access)
CREATE POLICY "Allow public read access to active plans" ON public.plans
  FOR SELECT USING (active = true);

-- Create RLS policies for payments (users can only see their own)
CREATE POLICY "Allow users to view their own payments" ON public.payments
  FOR SELECT USING (customer_email = auth.jwt() ->> 'email');

CREATE POLICY "Allow users to insert their own payments" ON public.payments
  FOR INSERT WITH CHECK (customer_email = auth.jwt() ->> 'email');

-- Create RLS policies for hotspot sessions
CREATE POLICY "Allow users to view their own sessions" ON public.hotspot_sessions
  FOR SELECT USING (
    payment_id IN (
      SELECT id FROM public.payments 
      WHERE customer_email = auth.jwt() ->> 'email'
    )
  );

-- Create RLS policies for system logs (admin only)
CREATE POLICY "Allow admin access to system logs" ON public.system_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_plans_active ON public.plans(active);
CREATE INDEX IF NOT EXISTS idx_plans_price ON public.plans(price_cents);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_pagar_me_id ON public.payments(pagar_me_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_email ON public.payments(customer_email);
CREATE INDEX IF NOT EXISTS idx_hotspot_sessions_status ON public.hotspot_sessions(status);
CREATE INDEX IF NOT EXISTS idx_hotspot_sessions_payment_id ON public.hotspot_sessions(payment_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at);

-- Insert sample plans
INSERT INTO public.plans (name, description, duration_hours, price_cents, active) VALUES
  ('1 Hora', 'Acesso à internet por 1 hora', 1, 500, true),
  ('3 Horas', 'Acesso à internet por 3 horas', 3, 1200, true),
  ('6 Horas', 'Acesso à internet por 6 horas', 6, 2000, true),
  ('1 Dia', 'Acesso à internet por 24 horas', 24, 3500, true),
  ('7 Dias', 'Acesso à internet por 7 dias', 168, 15000, true)
ON CONFLICT DO NOTHING;

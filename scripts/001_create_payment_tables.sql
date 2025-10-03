-- Tabela de planos de internet
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL, -- Preço em centavos
  duration_hours INTEGER NOT NULL, -- Duração em horas
  speed_download TEXT, -- Ex: "10Mbps"
  speed_upload TEXT, -- Ex: "5Mbps"
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pagamentos
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagar_me_order_id TEXT UNIQUE NOT NULL, -- ID do pedido no Pagar.me
  pagar_me_charge_id TEXT, -- ID da cobrança no Pagar.me
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_document TEXT, -- CPF/CNPJ
  amount_cents INTEGER NOT NULL, -- Valor em centavos
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, expired
  payment_method TEXT DEFAULT 'pix', -- pix, credit_card, etc
  pix_qr_code TEXT, -- QR Code do PIX
  pix_qr_code_url TEXT, -- URL do QR Code
  expires_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de sessões de hotspot (clientes conectados)
CREATE TABLE IF NOT EXISTS public.hotspot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  mac_address TEXT NOT NULL,
  ip_address TEXT,
  mikrotik_session_id TEXT, -- ID da sessão no Mikrotik
  status TEXT NOT NULL DEFAULT 'active', -- active, expired, disconnected
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  disconnected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de logs do sistema
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- payment, mikrotik, webhook, error
  message TEXT NOT NULL,
  data JSONB, -- Dados adicionais em JSON
  payment_id UUID REFERENCES public.payments(id),
  session_id UUID REFERENCES public.hotspot_sessions(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_pagar_me_order_id ON public.payments(pagar_me_order_id);
CREATE INDEX IF NOT EXISTS idx_hotspot_sessions_status ON public.hotspot_sessions(status);
CREATE INDEX IF NOT EXISTS idx_hotspot_sessions_mac ON public.hotspot_sessions(mac_address);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON public.system_logs(type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotspot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Permitir acesso público para operações do sistema
-- (Em produção, você pode querer restringir mais)
CREATE POLICY "Allow public access to plans" ON public.plans FOR ALL USING (true);
CREATE POLICY "Allow public access to payments" ON public.payments FOR ALL USING (true);
CREATE POLICY "Allow public access to hotspot_sessions" ON public.hotspot_sessions FOR ALL USING (true);
CREATE POLICY "Allow public access to system_logs" ON public.system_logs FOR ALL USING (true);

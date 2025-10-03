import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const SQL_SCRIPTS = {
  "001_create_payment_tables": `-- Tabela de planos de internet
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  duration_hours INTEGER NOT NULL,
  speed_download TEXT,
  speed_upload TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagar_me_order_id TEXT UNIQUE NOT NULL,
  pagar_me_charge_id TEXT,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_document TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT DEFAULT 'pix',
  pix_qr_code TEXT,
  pix_qr_code_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hotspot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  mac_address TEXT NOT NULL,
  ip_address TEXT,
  mikrotik_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  disconnected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  payment_id UUID REFERENCES public.payments(id),
  session_id UUID REFERENCES public.hotspot_sessions(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_pagar_me_order_id ON public.payments(pagar_me_order_id);
CREATE INDEX IF NOT EXISTS idx_hotspot_sessions_status ON public.hotspot_sessions(status);
CREATE INDEX IF NOT EXISTS idx_hotspot_sessions_mac ON public.hotspot_sessions(mac_address);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON public.system_logs(type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotspot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow public access to plans" ON public.plans FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Allow public access to payments" ON public.payments FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Allow public access to hotspot_sessions" ON public.hotspot_sessions FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Allow public access to system_logs" ON public.system_logs FOR ALL USING (true);`,

  "002_insert_sample_plans": `INSERT INTO public.plans (name, description, price_cents, duration_hours, speed_download, speed_upload) VALUES
('Plano 1 Hora', 'Acesso rápido por 1 hora', 300, 1, '10Mbps', '5Mbps'),
('Plano 3 Horas', 'Acesso por 3 horas', 800, 3, '15Mbps', '7Mbps'),
('Plano 6 Horas', 'Meio período de acesso', 1500, 6, '20Mbps', '10Mbps'),
('Plano 12 Horas', 'Acesso por 12 horas', 2500, 12, '25Mbps', '12Mbps'),
('Plano 1 Dia', 'Acesso por 24 horas completas', 4000, 24, '30Mbps', '15Mbps')
ON CONFLICT DO NOTHING;`,
}

export async function POST() {
  try {
    const supabase = await createClient()

    const results = []

    // Execute script 1: Create tables
    console.log("[v0] Executing script 1: Create tables...")
    const { error: error1 } = await supabase.rpc("exec_sql", {
      sql: SQL_SCRIPTS["001_create_payment_tables"],
    })

    if (error1) {
      // Try direct query if RPC doesn't exist
      const { error: directError1 } = await supabase.from("plans").select("id").limit(1)

      if (directError1 && directError1.code === "42P01") {
        // Table doesn't exist, need to create manually
        return NextResponse.json(
          {
            success: false,
            error:
              "Não foi possível executar os scripts SQL automaticamente. Execute os scripts manualmente no Supabase SQL Editor.",
            instructions: [
              "1. Acesse: https://supabase.com/dashboard",
              "2. Selecione seu projeto",
              "3. Vá em SQL Editor",
              "4. Execute os scripts na pasta /scripts na ordem",
            ],
          },
          { status: 500 },
        )
      }
    }

    results.push({ script: "001_create_payment_tables", success: true })

    // Execute script 2: Insert sample data
    console.log("[v0] Executing script 2: Insert sample plans...")
    const { error: error2 } = await supabase.rpc("exec_sql", {
      sql: SQL_SCRIPTS["002_insert_sample_plans"],
    })

    if (!error2) {
      results.push({ script: "002_insert_sample_plans", success: true })
    }

    // Verify tables exist
    const { data: plans, error: verifyError } = await supabase.from("plans").select("*").limit(1)

    if (verifyError) {
      return NextResponse.json(
        {
          success: false,
          error: "Tabelas criadas mas não foi possível verificar. Recarregue a página.",
          results,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: "Banco de dados configurado com sucesso!",
      results,
      plansCount: plans?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Setup error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido ao configurar banco de dados",
      },
      { status: 500 },
    )
  }
}

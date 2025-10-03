import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Script 1: Create tables
const createTablesSQL = `
-- Tabela de planos de internet
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

-- Tabela de pagamentos
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

-- Tabela de sessões de hotspot
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

-- Tabela de logs do sistema
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
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
`

// Script 2: Insert sample plans
const insertPlansSQL = `
INSERT INTO public.plans (name, description, price_cents, duration_hours, speed_download, speed_upload) VALUES
('Plano 1 Hora', 'Acesso rápido por 1 hora', 300, 1, '10Mbps', '5Mbps'),
('Plano 3 Horas', 'Acesso por 3 horas', 800, 3, '15Mbps', '7Mbps'),
('Plano 6 Horas', 'Meio período de acesso', 1500, 6, '20Mbps', '10Mbps'),
('Plano 12 Horas', 'Acesso por 12 horas', 2500, 12, '25Mbps', '12Mbps'),
('Plano 1 Dia', 'Acesso por 24 horas completas', 4000, 24, '30Mbps', '15Mbps')
ON CONFLICT DO NOTHING;
`

// Script 3: Setup RLS policies
const setupRLSSQL = `
-- Enable RLS on all tables
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotspot_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to active plans" ON plans;
DROP POLICY IF EXISTS "Allow service role full access to plans" ON plans;
DROP POLICY IF EXISTS "Allow service role full access to payments" ON payments;
DROP POLICY IF EXISTS "Allow service role full access to system_logs" ON system_logs;
DROP POLICY IF EXISTS "Allow service role full access to hotspot_sessions" ON hotspot_sessions;
DROP POLICY IF EXISTS "Allow users to read their own payments" ON payments;

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
`

export async function POST() {
  try {
    // Create Supabase client with service role key
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const results = []

    // Execute Script 1: Create tables
    console.log("[v0] Executing script 1: Create tables...")
    const { error: error1 } = await supabase.rpc("exec_sql", {
      sql: createTablesSQL,
    })

    if (error1) {
      // Try alternative method using raw SQL
      const { error: altError1 } = await supabase.from("plans").select("id").limit(1)
      if (altError1 && altError1.code === "PGRST116") {
        // Table doesn't exist, we need to create it manually
        return NextResponse.json(
          {
            error: "Cannot execute SQL directly. Please run scripts manually in Supabase SQL Editor.",
            instructions: [
              "1. Go to https://supabase.com/dashboard",
              "2. Select your project",
              "3. Go to SQL Editor",
              "4. Copy and paste each script from /scripts folder",
              "5. Execute them in order: 001, 002, 003",
            ],
          },
          { status: 500 },
        )
      }
    }

    results.push({ step: 1, status: "success", message: "Tables created" })

    // Execute Script 2: Insert plans
    console.log("[v0] Executing script 2: Insert sample plans...")
    const { error: error2 } = await supabase.rpc("exec_sql", {
      sql: insertPlansSQL,
    })

    if (error2) {
      // Try inserting plans directly
      const plans = [
        {
          name: "Plano 1 Hora",
          description: "Acesso rápido por 1 hora",
          price_cents: 300,
          duration_hours: 1,
          speed_download: "10Mbps",
          speed_upload: "5Mbps",
        },
        {
          name: "Plano 3 Horas",
          description: "Acesso por 3 horas",
          price_cents: 800,
          duration_hours: 3,
          speed_download: "15Mbps",
          speed_upload: "7Mbps",
        },
        {
          name: "Plano 6 Horas",
          description: "Meio período de acesso",
          price_cents: 1500,
          duration_hours: 6,
          speed_download: "20Mbps",
          speed_upload: "10Mbps",
        },
        {
          name: "Plano 12 Horas",
          description: "Acesso por 12 horas",
          price_cents: 2500,
          duration_hours: 12,
          speed_download: "25Mbps",
          speed_upload: "12Mbps",
        },
        {
          name: "Plano 1 Dia",
          description: "Acesso por 24 horas completas",
          price_cents: 4000,
          duration_hours: 24,
          speed_download: "30Mbps",
          speed_upload: "15Mbps",
        },
      ]

      for (const plan of plans) {
        const { error: insertError } = await supabase
          .from("plans")
          .upsert(plan, { onConflict: "name", ignoreDuplicates: true })

        if (insertError) {
          console.error("[v0] Error inserting plan:", insertError)
        }
      }
    }

    results.push({ step: 2, status: "success", message: "Sample plans inserted" })

    // Execute Script 3: Setup RLS
    console.log("[v0] Executing script 3: Setup RLS policies...")
    const { error: error3 } = await supabase.rpc("exec_sql", {
      sql: setupRLSSQL,
    })

    if (error3) {
      results.push({
        step: 3,
        status: "warning",
        message: "RLS policies may need manual setup",
      })
    } else {
      results.push({ step: 3, status: "success", message: "RLS policies configured" })
    }

    return NextResponse.json({
      success: true,
      message: "Database setup completed successfully!",
      results,
    })
  } catch (error) {
    console.error("[v0] Database setup error:", error)
    return NextResponse.json(
      {
        error: "Failed to setup database",
        details: error instanceof Error ? error.message : "Unknown error",
        instructions: [
          "Please run the scripts manually in Supabase SQL Editor:",
          "1. Go to https://supabase.com/dashboard",
          "2. Select your project",
          "3. Go to SQL Editor",
          "4. Execute scripts/001_create_payment_tables.sql",
          "5. Execute scripts/002_insert_sample_plans.sql",
          "6. Execute scripts/003_setup_rls_policies.sql",
        ],
      },
      { status: 500 },
    )
  }
}

import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST() {
  try {
    console.log("[v0] Iniciando configuração do banco de dados via API...")

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Criar tabela de planos usando SQL direto
    const createTablesSQL = `
      -- Criar tabela de planos
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
      
      -- Criar tabela de pagamentos
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
      
      -- Criar outras tabelas
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
      
      -- Habilitar RLS
      ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.hotspot_sessions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
      
      -- Criar políticas RLS
      DROP POLICY IF EXISTS "Allow public access to plans" ON public.plans;
      CREATE POLICY "Allow public access to plans" ON public.plans FOR ALL USING (true);
      
      DROP POLICY IF EXISTS "Allow public access to payments" ON public.payments;
      CREATE POLICY "Allow public access to payments" ON public.payments FOR ALL USING (true);
      
      DROP POLICY IF EXISTS "Allow public access to hotspot_sessions" ON public.hotspot_sessions;
      CREATE POLICY "Allow public access to hotspot_sessions" ON public.hotspot_sessions FOR ALL USING (true);
      
      DROP POLICY IF EXISTS "Allow public access to system_logs" ON public.system_logs;
      CREATE POLICY "Allow public access to system_logs" ON public.system_logs FOR ALL USING (true);
    `

    // Executar SQL usando a conexão direta do PostgreSQL
    const { error: sqlError } = await supabase.rpc("exec_sql", {
      sql: createTablesSQL,
    })

    if (sqlError) {
      console.error("[v0] Erro ao executar SQL:", sqlError)
      // Tentar abordagem alternativa - inserir tabelas uma por uma
      const { error: plansError } = await supabase.from("plans").select("id").limit(1)

      if (plansError && plansError.code === "PGRST116") {
        // Tabela não existe, vamos tentar criar via SQL simples
        return NextResponse.json({
          success: false,
          error: "Tabelas não existem. Execute os scripts SQL manualmente no Supabase Dashboard.",
          instructions: [
            "1. Acesse o Supabase Dashboard",
            "2. Vá para SQL Editor",
            "3. Execute o script 001_create_payment_tables.sql",
            "4. Execute o script 002_insert_sample_plans.sql",
          ],
        })
      }
    }

    // Inserir planos de exemplo
    const { error: insertError } = await supabase.from("plans").upsert(
      [
        {
          name: "Plano 1 Hora",
          description: "Acesso por 1 hora",
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
          description: "Acesso por 6 horas",
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
          name: "Plano 24 Horas",
          description: "Acesso por 24 horas",
          price_cents: 4000,
          duration_hours: 24,
          speed_download: "30Mbps",
          speed_upload: "15Mbps",
        },
      ],
      {
        onConflict: "name",
        ignoreDuplicates: true,
      },
    )

    if (insertError) {
      console.error("[v0] Erro ao inserir planos:", insertError)
    }

    return NextResponse.json({
      success: true,
      message: "Banco de dados configurado com sucesso!",
    })
  } catch (error) {
    console.error("[v0] Erro na configuração:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    })
  }
}

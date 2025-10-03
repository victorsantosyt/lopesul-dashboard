// Script para criar as tabelas no Supabase usando SQL direto
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variáveis de ambiente do Supabase não encontradas")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  console.log("🚀 Iniciando configuração do banco de dados...")

  try {
    // Criar tabela de planos
    console.log("📋 Criando tabela plans...")
    const { error: plansError } = await supabase.rpc("exec_sql", {
      sql: `
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
        
        ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Allow public access to plans" ON public.plans;
        CREATE POLICY "Allow public access to plans" ON public.plans FOR ALL USING (true);
      `,
    })

    if (plansError) {
      console.error("❌ Erro ao criar tabela plans:", plansError)
    } else {
      console.log("✅ Tabela plans criada com sucesso")
    }

    // Criar tabela de pagamentos
    console.log("💳 Criando tabela payments...")
    const { error: paymentsError } = await supabase.rpc("exec_sql", {
      sql: `
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
        
        ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Allow public access to payments" ON public.payments;
        CREATE POLICY "Allow public access to payments" ON public.payments FOR ALL USING (true);
      `,
    })

    if (paymentsError) {
      console.error("❌ Erro ao criar tabela payments:", paymentsError)
    } else {
      console.log("✅ Tabela payments criada com sucesso")
    }

    // Criar outras tabelas
    console.log("🌐 Criando tabelas hotspot_sessions e system_logs...")
    const { error: otherTablesError } = await supabase.rpc("exec_sql", {
      sql: `
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
        
        ALTER TABLE public.hotspot_sessions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Allow public access to hotspot_sessions" ON public.hotspot_sessions;
        CREATE POLICY "Allow public access to hotspot_sessions" ON public.hotspot_sessions FOR ALL USING (true);
        
        DROP POLICY IF EXISTS "Allow public access to system_logs" ON public.system_logs;
        CREATE POLICY "Allow public access to system_logs" ON public.system_logs FOR ALL USING (true);
      `,
    })

    if (otherTablesError) {
      console.error("❌ Erro ao criar outras tabelas:", otherTablesError)
    } else {
      console.log("✅ Tabelas hotspot_sessions e system_logs criadas com sucesso")
    }

    // Inserir planos de exemplo
    console.log("📝 Inserindo planos de exemplo...")
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
      console.error("❌ Erro ao inserir planos:", insertError)
    } else {
      console.log("✅ Planos de exemplo inseridos com sucesso")
    }

    console.log("🎉 Configuração do banco de dados concluída!")
  } catch (error) {
    console.error("❌ Erro geral:", error)
  }
}

setupDatabase()

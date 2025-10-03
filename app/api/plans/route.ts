import { type NextRequest, NextResponse } from "next/server"

function getDefaultPlansResponse() {
  const defaultPlans = [
    {
      id: "default-1",
      name: "1 Hora",
      description: "Acesso à internet por 1 hora",
      duration_hours: 1,
      price_cents: 500,
      active: true,
    },
    {
      id: "default-2",
      name: "3 Horas",
      description: "Acesso à internet por 3 horas",
      duration_hours: 3,
      price_cents: 1200,
      active: true,
    },
    {
      id: "default-3",
      name: "6 Horas",
      description: "Acesso à internet por 6 horas",
      duration_hours: 6,
      price_cents: 2000,
      active: true,
    },
    {
      id: "default-4",
      name: "1 Dia",
      description: "Acesso à internet por 24 horas",
      duration_hours: 24,
      price_cents: 3500,
      active: true,
    },
    {
      id: "default-5",
      name: "7 Dias",
      description: "Acesso à internet por 7 dias",
      duration_hours: 168,
      price_cents: 15000,
      active: true,
    },
  ]

  return NextResponse.json(
    {
      success: true,
      plans: defaultPlans,
      message: "Usando planos padrão - execute o script SQL 002_insert_sample_plans.sql para criar as tabelas",
      database_status: "tables_not_created",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  )
}

export async function GET(request: NextRequest) {
  console.log("[v0] API /api/plans chamada")

  // This prevents the 404 error from Supabase when tables don't exist
  return getDefaultPlansResponse()

  // TODO: Uncomment the code below after executing the SQL script to create tables
  /*
  try {
    const supabase = await createClient()

    const { data: plans, error } = await supabase
      .from("plans")
      .select("*")
      .eq("active", true)
      .order("price_cents", { ascending: true })

    if (error) {
      console.error("[v0] Erro ao buscar planos:", error.message)
      return getDefaultPlansResponse()
    }

    console.log("[v0] Planos encontrados:", plans?.length || 0)
    return NextResponse.json(
      { success: true, plans },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    )
  } catch (error: any) {
    console.error("[v0] Erro capturado na API de planos:", error)
    return getDefaultPlansResponse()
  }
  */
}

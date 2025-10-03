import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Buscar sessões ativas
    const { data: sessions, error } = await supabase
      .from("hotspot_sessions")
      .select(
        `
        *,
        payment:payments(
          customer_name,
          customer_email,
          plan:plans(name, duration_hours)
        )
      `,
      )
      .eq("status", "active")
      .order("started_at", { ascending: false })

    if (error) {
      console.error("[v0] Erro ao buscar sessões:", error)
      return NextResponse.json({ success: false, error: "Erro ao buscar sessões" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sessions: sessions || [],
      total: sessions?.length || 0,
    })
  } catch (error: any) {
    console.error("[v0] Erro ao consultar sessões:", error)
    return NextResponse.json({ success: false, error: "Erro ao consultar sessões" }, { status: 500 })
  }
}

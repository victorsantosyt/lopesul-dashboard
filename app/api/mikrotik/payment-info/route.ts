import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const pagarMeOrderId = searchParams.get("pagarMeOrderId")

    if (!pagarMeOrderId) {
      return NextResponse.json({ success: false, error: "pagarMeOrderId é obrigatório" }, { status: 400 })
    }

    const supabase = await createClient()

    // Buscar pagamento pelo ID do Pagar.me
    const { data: payment, error } = await supabase
      .from("payments")
      .select(
        `
        *,
        plan:plans(*)
      `,
      )
      .eq("pagar_me_order_id", pagarMeOrderId)
      .single()

    if (error || !payment) {
      return NextResponse.json({ success: false, error: "Pagamento não encontrado" }, { status: 404 })
    }

    // Retornar informações relevantes para o Mikrotik
    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amount_cents: payment.amount_cents,
        customer_name: payment.customer_name,
        customer_email: payment.customer_email,
        customer_phone: payment.customer_phone,
        customer_document: payment.customer_document,
        paid_at: payment.paid_at,
        created_at: payment.created_at,
        plan: {
          name: payment.plan.name,
          duration_hours: payment.plan.duration_hours,
          speed_download: payment.plan.speed_download,
          speed_upload: payment.plan.speed_upload,
        },
      },
    })
  } catch (error: any) {
    console.error("[v0] Erro ao consultar pagamento:", error)
    return NextResponse.json({ success: false, error: "Erro ao consultar pagamento" }, { status: 500 })
  }
}

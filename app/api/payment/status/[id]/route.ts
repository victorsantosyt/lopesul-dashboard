import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (id.startsWith("temp-")) {
      return NextResponse.json({
        success: true,
        payment: {
          id,
          status: "pending",
          amount: 0,
          customer_name: "",
          customer_email: "",
          mikrotik_username: "",
          mikrotik_password: "",
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          plan: null,
        },
        message: "Database not initialized. Please run the setup scripts.",
      })
    }

    const supabase = await createAdminClient()

    const { data: payment, error } = await supabase
      .from("payments")
      .select(`
        *,
        plans (
          name,
          description,
          duration_hours,
          price_cents
        )
      `)
      .eq("id", id)
      .single()

    if (error || !payment) {
      console.error("[v0] Payment not found:", error)
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 })
    }

    if (payment.status === "pending" && payment.pagar_me_order_id) {
      try {
        const checkResponse = await fetch(`${request.nextUrl.origin}/api/payment/check-status/${id}`, {
          method: "POST",
        })
        if (checkResponse.ok) {
          const checkData = await checkResponse.json()
          if (checkData.success && checkData.changed) {
            payment.status = checkData.status
          }
        }
      } catch (error) {
        console.error("[v0] Error auto-checking status:", error)
      }
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount_cents,
        customer_name: payment.customer_name,
        customer_email: payment.customer_email,
        mikrotik_username: payment.mikrotik_username,
        mikrotik_password: payment.mikrotik_password,
        expires_at: payment.expires_at,
        created_at: payment.created_at,
        updated_at: payment.updated_at,
        plan: payment.plans,
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching payment status:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

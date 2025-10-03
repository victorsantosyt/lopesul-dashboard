import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log("[v0] Checking payment status for ID:", id)

    const supabase = await createAdminClient()
    const { data: payment, error: paymentError } = await supabase.from("payments").select("*").eq("id", id).single()

    if (paymentError || !payment) {
      console.error("[v0] Payment not found:", paymentError)
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 })
    }

    if (!payment.pagar_me_order_id) {
      console.error("[v0] Payment missing pagar_me_order_id:", payment.id)
      return NextResponse.json({ error: "Pagamento inválido - ID do pedido não encontrado" }, { status: 400 })
    }

    const pagarMeApiKey = process.env.PAGAR_ME_API_KEY
    if (!pagarMeApiKey) {
      console.error("[v0] Pagar.me API key not configured")
      return NextResponse.json({ error: "Configuração inválida" }, { status: 500 })
    }

    console.log("[v0] Fetching order from Pagar.me:", payment.pagar_me_order_id)
    const pagarMeResponse = await fetch(`https://api.pagar.me/core/v5/orders/${payment.pagar_me_order_id}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(pagarMeApiKey + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
    })

    if (!pagarMeResponse.ok) {
      console.error("[v0] Pagar.me API error:", pagarMeResponse.status)
      return NextResponse.json({ error: "Erro ao consultar status do pagamento" }, { status: 500 })
    }

    const orderData = await pagarMeResponse.json()
    console.log("[v0] Pagar.me order status:", orderData.status)
    console.log("[v0] Pagar.me charges:", orderData.charges?.length || 0)

    let newStatus = payment.status
    if (orderData.status === "paid") {
      newStatus = "paid"
    } else if (orderData.status === "canceled" || orderData.status === "failed") {
      newStatus = "failed"
    } else if (orderData.charges && orderData.charges.length > 0) {
      const lastCharge = orderData.charges[0]
      if (lastCharge.status === "paid") {
        newStatus = "paid"
      } else if (lastCharge.status === "failed" || lastCharge.status === "canceled") {
        newStatus = "failed"
      }
    }

    console.log("[v0] Current status:", payment.status, "New status:", newStatus)

    if (newStatus !== payment.status) {
      console.log("[v0] Updating payment status to:", newStatus)
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (updateError) {
        console.error("[v0] Error updating payment:", updateError)
      } else {
        console.log("[v0] Payment status updated successfully")

        await supabase.from("system_logs").insert({
          level: "info",
          message: `Status do pagamento atualizado: ${payment.status} → ${newStatus}`,
          context: {
            payment_id: id,
            old_status: payment.status,
            new_status: newStatus,
            pagar_me_order_id: payment.pagar_me_order_id,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      changed: newStatus !== payment.status,
    })
  } catch (error) {
    console.error("[v0] Error checking payment status:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

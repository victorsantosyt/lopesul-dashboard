import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validatePagarMeWebhook } from "@/lib/pagar-me"
import { hotspotManager } from "@/lib/hotspot-manager"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const signature = request.headers.get("x-hub-signature-256") || ""
    const payload = await request.text()

    // Validar assinatura do webhook
    if (!validatePagarMeWebhook(signature, payload)) {
      console.error("Webhook inválido - assinatura não confere")
      return NextResponse.json({ error: "Webhook inválido" }, { status: 401 })
    }

    const webhookData = JSON.parse(payload)
    console.log("[v0] Webhook recebido:", webhookData)

    // Processar diferentes tipos de eventos
    const { type, data } = webhookData

    if (type === "order.paid" || type === "charge.paid") {
      const orderId = data.id

      // Buscar pagamento no banco
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .select("*")
        .eq("pagar_me_order_id", orderId)
        .single()

      if (paymentError || !payment) {
        console.error("Pagamento não encontrado:", orderId)
        return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 })
      }

      // Atualizar status do pagamento
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)

      if (updateError) {
        console.error("Erro ao atualizar pagamento:", updateError)
        return NextResponse.json({ error: "Erro ao atualizar pagamento" }, { status: 500 })
      }

      // Buscar MAC address do checkout (pode estar nos dados do webhook ou precisar ser buscado)
      // Por enquanto, vamos usar um MAC fictício - em produção, isso viria do processo de checkout
      const macAddress = "AA:BB:CC:DD:EE:FF" // Este MAC deveria vir do processo de checkout

      // Liberar hotspot automaticamente
      try {
        const hotspotReleased = await hotspotManager.releaseHotspotAccess(payment.id, macAddress)

        if (hotspotReleased) {
          console.log("[v0] Hotspot liberado automaticamente para pagamento:", payment.id)
        } else {
          console.error("[v0] Falha ao liberar hotspot automaticamente para pagamento:", payment.id)
        }
      } catch (hotspotError) {
        console.error("[v0] Erro na liberação automática do hotspot:", hotspotError)
        // Log do erro mas não falha o webhook
        await supabase.from("system_logs").insert({
          type: "error",
          message: `Erro na liberação automática do hotspot: ${hotspotError}`,
          data: {
            payment_id: payment.id,
            webhook_type: type,
            error: hotspotError.toString(),
          },
          payment_id: payment.id,
        })
      }

      // Log do pagamento confirmado
      await supabase.from("system_logs").insert({
        type: "payment",
        message: `Pagamento confirmado via webhook`,
        data: {
          webhook_type: type,
          order_id: orderId,
          amount: data.amount,
        },
        payment_id: payment.id,
      })

      console.log("[v0] Pagamento confirmado:", payment.id)

      return NextResponse.json({ success: true })
    }

    // Outros tipos de webhook (falha, expiração, etc.)
    if (type === "order.payment_failed" || type === "charge.payment_failed") {
      const orderId = data.id

      await supabase
        .from("payments")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("pagar_me_order_id", orderId)

      await supabase.from("system_logs").insert({
        type: "payment",
        message: `Pagamento falhou via webhook`,
        data: { webhook_type: type, order_id: orderId },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro no webhook:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

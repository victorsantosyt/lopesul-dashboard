import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import crypto from "crypto"

// Verificar assinatura do webhook do Pagar.me
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret)
  hmac.update(payload)
  const digest = hmac.digest("hex")
  return digest === signature
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-hub-signature")
    const rawBody = await request.text()

    // Verificar assinatura do webhook
    const webhookSecret = process.env.PAGAR_ME_WEBHOOK_SECRET
    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.error("[v0] Webhook signature verification failed")
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      }
    }

    const event = JSON.parse(rawBody)

    console.log("[v0] Webhook received:", {
      type: event.type,
      orderId: event.data?.id,
      status: event.data?.status,
    })

    // Processar apenas eventos de pedido
    if (event.type === "order.paid" || event.type === "charge.paid") {
      const order = event.data
      const charge = order.charges?.[0] || event.data

      const supabase = await createClient()

      // Buscar pagamento pelo ID do pedido ou charge do Pagar.me
      const { data: payment, error: findError } = await supabase
        .from("payments")
        .select("*")
        .or(`pagar_me_order_id.eq.${order.id},pagar_me_charge_id.eq.${charge.id}`)
        .single()

      if (findError || !payment) {
        console.error("[v0] Payment not found for order:", order.id)
        return NextResponse.json({ error: "Payment not found" }, { status: 404 })
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
        console.error("[v0] Error updating payment:", updateError)
        return NextResponse.json({ error: "Error updating payment" }, { status: 500 })
      }

      // Buscar MAC address do log do sistema
      const { data: log } = await supabase.from("system_logs").select("data").eq("payment_id", payment.id).single()

      const macAddress = log?.data?.mac_address

      // Criar sessão do hotspot
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + (payment.plan?.duration_hours || 1))

      const { error: sessionError } = await supabase.from("hotspot_sessions").insert({
        payment_id: payment.id,
        mikrotik_username: payment.mikrotik_username,
        status: "active",
        start_time: new Date().toISOString(),
        end_time: expiresAt.toISOString(),
      })

      if (sessionError) {
        console.error("[v0] Error creating hotspot session:", sessionError)
      }

      // Registrar log de pagamento confirmado
      await supabase.from("system_logs").insert({
        level: "info",
        message: `Pagamento confirmado via webhook`,
        context: {
          payment_id: payment.id,
          order_id: order.id,
          charge_id: charge.id,
          mac_address: macAddress,
          customer_email: payment.customer_email,
        },
      })

      console.log("[v0] Payment processed successfully:", payment.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

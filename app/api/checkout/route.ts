import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { createPagarMeOrder } from "@/lib/pagar-me"

const DEFAULT_PLANS = [
  {
    id: "default-1",
    name: "1 Hora",
    description: "Acesso à internet por 1 hora",
    duration_hours: 1,
    price_cents: 500,
  },
  {
    id: "default-2",
    name: "3 Horas",
    description: "Acesso à internet por 3 horas",
    duration_hours: 3,
    price_cents: 1200,
  },
  {
    id: "default-3",
    name: "6 Horas",
    description: "Acesso à internet por 6 horas",
    duration_hours: 6,
    price_cents: 2000,
  },
  {
    id: "default-4",
    name: "1 Dia",
    description: "Acesso à internet por 24 horas",
    duration_hours: 24,
    price_cents: 3500,
  },
  {
    id: "default-5",
    name: "7 Dias",
    description: "Acesso à internet por 7 dias",
    duration_hours: 168,
    price_cents: 15000,
  },
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { planId, customerName, customerEmail, customerPhone, customerDocument, macAddress } = body

    if (!planId || !customerName || !customerEmail || !customerDocument || !macAddress) {
      console.error("[v0] Validation error: Missing required fields")
      return NextResponse.json({ error: "Dados obrigatórios não fornecidos" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    let plan
    const isDefaultPlan = planId.startsWith("default-")

    if (isDefaultPlan) {
      plan = DEFAULT_PLANS.find((p) => p.id === planId)
      if (!plan) {
        console.error("[v0] Default plan not found:", planId)
        return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 })
      }
      console.log("[v0] Using default plan:", plan.name)
    } else {
      const { data: dbPlan, error: planError } = await supabase
        .from("plans")
        .select("*")
        .eq("id", planId)
        .eq("active", true)
        .single()

      if (planError || !dbPlan) {
        console.error("[v0] Plan not found in database:", planError)
        return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 })
      }
      plan = dbPlan
    }

    const orderCode = `HOTSPOT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const mikrotikUsername = macAddress
    const mikrotikPassword = Math.random().toString(36).substr(2, 12)

    console.log("[v0] Creating Pagar.me order for:", customerEmail, "MAC:", macAddress)

    let pagarMeOrder
    try {
      pagarMeOrder = await createPagarMeOrder({
        code: orderCode,
        amount: plan.price_cents,
        currency: "BRL",
        customer: {
          name: customerName,
          email: customerEmail,
          document: customerDocument.replace(/\D/g, ""),
          type: customerDocument.length <= 11 ? "individual" : "company",
          phones: customerPhone
            ? {
                mobile_phone: {
                  country_code: "55",
                  area_code: customerPhone.substring(0, 2),
                  number: customerPhone.substring(2),
                },
              }
            : undefined,
        },
        items: [
          {
            code: isDefaultPlan ? plan.name : plan.id,
            description: plan.name,
            amount: plan.price_cents,
            quantity: 1,
          },
        ],
        payments: [
          {
            payment_method: "pix",
            pix: {
              expires_in: 3600,
            },
          },
        ],
      })
      console.log("[v0] Pagar.me order created successfully:", pagarMeOrder.id)
    } catch (pagarMeError: any) {
      console.error("[v0] Pagar.me API error:", pagarMeError.message)
      return NextResponse.json({ error: "Erro ao criar pagamento no Pagar.me. Tente novamente." }, { status: 500 })
    }

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    let paymentId = `temp-${Date.now()}`
    try {
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          pagar_me_order_id: pagarMeOrder.id,
          pagar_me_transaction_id:
            pagarMeOrder.charges[0]?.last_transaction?.id || pagarMeOrder.charges[0]?.id || pagarMeOrder.id,
          plan_id: isDefaultPlan ? null : planId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          customer_document: customerDocument,
          amount_cents: plan.price_cents,
          status: "pending",
          mikrotik_username: mikrotikUsername,
          mikrotik_password: mikrotikPassword,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (!paymentError && payment) {
        paymentId = payment.id
        console.log("[v0] Payment saved to database:", paymentId, "MAC:", macAddress)

        await supabase.from("system_logs").insert({
          level: "info",
          message: `Checkout criado - ${plan.name}`,
          context: {
            payment_id: payment.id,
            plan_name: plan.name,
            amount: plan.price_cents,
            mac_address: macAddress,
            customer_email: customerEmail,
            pagar_me_order_id: pagarMeOrder.id,
          },
        })
      } else {
        console.error("[v0] Could not save payment to database:", paymentError?.message)
      }
    } catch (dbError: any) {
      console.error("[v0] Database error:", dbError.message)
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: paymentId,
        amount: plan.price_cents,
        qr_code: pagarMeOrder.charges[0]?.last_transaction?.qr_code,
        qr_code_url: pagarMeOrder.charges[0]?.last_transaction?.qr_code_url,
        expires_at: expiresAt.toISOString(),
      },
      plan: {
        name: plan.name,
        duration_hours: plan.duration_hours,
      },
      credentials: {
        username: mikrotikUsername,
        password: mikrotikPassword,
      },
    })
  } catch (error: any) {
    console.error("[v0] Checkout error:", error.message, error.stack)
    return NextResponse.json(
      { error: "Erro interno do servidor. Tente novamente em alguns instantes." },
      { status: 500 },
    )
  }
}

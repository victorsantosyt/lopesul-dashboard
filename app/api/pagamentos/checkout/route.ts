// app/api/pagamentos/checkout/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PAGARME_API_URL = "https://api.pagar.me/core/v5"
const PAGARME_SECRET_KEY = process.env.PAGAR_ME_API_KEY || process.env.PAGARME_SECRET_KEY || ""

export async function POST(req: Request) {
  try {
    if (!PAGARME_SECRET_KEY) {
      return NextResponse.json({ error: "Missing PAGAR_ME_API_KEY" }, { status: 500 })
    }

    const body = await req.json()
    const { amount, description, name, cpf, ip, mac, plan } = body

    if (!amount || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Generate unique external ID
    const externalId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create order in Pagar.me
    const orderPayload = {
      closed: true,
      customer: {
        name: name || "Cliente",
        type: cpf && cpf.length > 11 ? "company" : "individual",
        ...(cpf && { document: cpf.replace(/\D/g, "") }),
      },
      items: [
        {
          amount: Number.parseInt(amount.toString(), 10),
          description: description || "Acesso Wi-Fi",
          quantity: 1,
        },
      ],
      payments: [
        {
          payment_method: "pix",
          pix: {
            expires_in: 1800, // 30 minutes
          },
        },
      ],
      metadata: {
        ip: ip || "",
        mac: mac || "",
        plan: plan || "",
      },
    }

    const response = await fetch(`${PAGARME_API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${PAGARME_SECRET_KEY}:`).toString("base64")}`,
        "Idempotency-Key": externalId,
      },
      body: JSON.stringify(orderPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Checkout] Pagar.me error:", errorText)
      return NextResponse.json({ error: "Failed to create payment" }, { status: response.status })
    }

    const order = await response.json()

    // Extract PIX data
    const charges = Array.isArray(order?.charges) ? order.charges : []
    const charge = charges[0]
    const transaction = charge?.last_transaction || {}

    const qrCode = transaction?.qr_code_emv || transaction?.qr_code_text || transaction?.qr_code || null
    const qrCodeUrl = transaction?.qr_code_url || transaction?.qr_code || null

    // Save to database
    const pedido = await prisma.pedido.create({
      data: {
        externalId: order.id || externalId,
        valor: amount,
        descricao: description,
        clienteNome: name,
        clienteCpf: cpf,
        clienteIp: ip,
        clienteMac: mac,
        status: "PENDING",
        metodo: "PIX",
        qrCode,
        qrCodeUrl,
        pixCopiaECola: qrCode,
        expiresAt: transaction?.expires_at ? new Date(transaction.expires_at) : null,
      },
    })

    // Create charge record
    if (charge?.id) {
      await prisma.charge.create({
        data: {
          pedidoId: pedido.id,
          chargeId: charge.id,
          status: "PENDING",
          valor: amount,
          metodo: "PIX",
        },
      })
    }

    return NextResponse.json({
      success: true,
      orderId: pedido.externalId,
      qrCode,
      qrCodeUrl,
      expiresAt: transaction?.expires_at,
    })
  } catch (error: any) {
    console.error("[Checkout] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

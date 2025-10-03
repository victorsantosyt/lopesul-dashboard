// app/api/webhook/pagarme/route.ts
import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { liberarClienteNoMikrotik } from "@/lib/mikrotik"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function timingSafeEq(a: string, b: string): boolean {
  const A = Buffer.from(a || "")
  const B = Buffer.from(b || "")
  if (A.length !== B.length) return false
  return crypto.timingSafeEqual(A, B)
}

function verifyPagarmeSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret =
    process.env.PAGAR_ME_WEBHOOK_SECRET || process.env.PAGARME_SECRET_KEY || process.env.PAGAR_ME_API_KEY || ""

  if (!secret) {
    console.warn("[Webhook] No secret configured, skipping signature verification")
    return true
  }

  if (!signatureHeader) return false

  const got = String(signatureHeader).trim()
  const provided = got.startsWith("sha1=") ? got : `sha1=${got}`

  const expected = "sha1=" + crypto.createHmac("sha1", secret).update(rawBody).digest("hex")

  return timingSafeEq(expected, provided)
}

function mapStatus(status: string): string {
  const s = String(status || "").toLowerCase()

  if (["paid", "succeeded"].includes(s)) return "PAID"
  if (["canceled", "cancelled"].includes(s)) return "CANCELED"
  if (["failed"].includes(s)) return "FAILED"
  if (["expired"].includes(s)) return "EXPIRED"

  return "PENDING"
}

interface WebhookEvent {
  type?: string
  event?: string
  data?: any
  payload?: any
}

function extractBasics(evt: WebhookEvent) {
  const type = evt?.type || evt?.event || ""
  const data = evt?.data || evt?.payload || evt || {}
  const order = data?.order || (data?.object === "order" ? data : undefined) || data

  const orderCode = order?.code || order?.id || null
  const orderStatus = order?.status || null

  const charges = Array.isArray(order?.charges) ? order.charges : []
  const charge = charges[0] || data?.charge || null

  const chargeId = charge?.id || null
  const chargeStatus = charge?.status || null
  const method = (charge?.payment_method || "").toUpperCase()

  const trx = charge?.last_transaction || charge?.transaction || {}
  const qrText = trx?.qr_code_emv || trx?.qr_code_text || trx?.qr_code || trx?.emv || trx?.payload || null
  const qrUrl = trx?.qr_code_url || trx?.qrcode || null

  return {
    type,
    orderCode,
    orderStatus,
    chargeId,
    chargeStatus,
    method,
    qrText,
    qrUrl,
    rawOrder: order,
    rawCharge: charge,
  }
}

async function markPaidAndRelease(externalId: string) {
  const pedido = await prisma.pedido.findFirst({
    where: { externalId },
  })

  if (!pedido) {
    console.warn(`[Webhook] Pedido not found: ${externalId}`)
    return
  }

  if (pedido.status !== "PAID") {
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        liberadoAt: new Date(),
      },
    })

    // Create active session
    const expiraEm = new Date()
    expiraEm.setHours(expiraEm.getHours() + 2) // 2 hours default

    await prisma.sessaoAtiva.create({
      data: {
        pedidoId: pedido.id,
        clienteIp: pedido.clienteIp || "",
        clienteMac: pedido.clienteMac,
        expiraEm,
        ativa: true,
      },
    })

    // Release on Mikrotik
    if (pedido.clienteIp) {
      await liberarClienteNoMikrotik({
        ip: pedido.clienteIp,
        mac: pedido.clienteMac || undefined,
        busId: `Order-${externalId}`,
        minutos: 120,
      })
    }
  }
}

export async function POST(req: Request) {
  try {
    const raw = await req.text()
    const sig = req.headers.get("x-hub-signature") || req.headers.get("x-postbacks-signature") || ""

    if (!verifyPagarmeSignature(raw, sig)) {
      console.error("[Webhook] Invalid signature")
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
    }

    const evt: WebhookEvent = JSON.parse(raw)
    const basics = extractBasics(evt)
    const mapped = mapStatus(basics.chargeStatus || basics.orderStatus || "")

    // Log webhook event
    try {
      await prisma.webhookLog.create({
        data: {
          evento: basics.type,
          payload: JSON.stringify(evt),
          processado: true,
        },
      })
    } catch (error) {
      console.error("[Webhook] Failed to log event:", error)
    }

    // Update order status
    if (basics.orderCode) {
      await prisma.pedido.updateMany({
        where: { externalId: basics.orderCode },
        data: { status: mapped },
      })
    }

    // Update or create charge
    if (basics.chargeId) {
      const existing = await prisma.charge.findFirst({
        where: { chargeId: basics.chargeId },
        select: { id: true },
      })

      const chargeData = {
        status: mapped as any,
        metodo: basics.method === "PIX" ? "PIX" : basics.method || "CARD",
        paidAt: mapped === "PAID" ? new Date() : null,
      }

      if (existing) {
        await prisma.charge.update({
          where: { id: existing.id },
          data: chargeData,
        })
      } else if (basics.orderCode) {
        const pedido = await prisma.pedido.findFirst({
          where: { externalId: basics.orderCode },
          select: { id: true },
        })

        if (pedido) {
          await prisma.charge.create({
            data: {
              pedidoId: pedido.id,
              chargeId: basics.chargeId,
              valor: 0, // Will be updated from order
              ...chargeData,
            },
          })
        }
      }
    }

    // Release access if paid
    if (mapped === "PAID" && basics.orderCode) {
      await markPaidAndRelease(basics.orderCode)
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[Webhook] Error:", error)
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500 })
  }
}

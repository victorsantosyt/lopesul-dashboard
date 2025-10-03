import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import PagarMeClient from "@/lib/pagarme"
import MikrotikClient from "@/lib/mikrotik"
import { registrarAuditoria, extrairInfoRequisicao } from "@/lib/audit"

const prisma = new PrismaClient()
const pagarme = new PagarMeClient()

export async function POST(request) {
  const { ipAddress, userAgent } = extrairInfoRequisicao(request)

  try {
    const signature = request.headers.get("x-hub-signature")
    const rawBody = await request.text()

    // Valida assinatura do webhook
    if (!pagarme.validarWebhookSignature(rawBody, signature)) {
      console.error("[Webhook] Assinatura inválida")

      await registrarAuditoria({
        acao: "WEBHOOK_RECEBIDO",
        entidade: "Webhook",
        detalhes: { tipo: "signature_invalid" },
        ipAddress,
        userAgent,
        sucesso: false,
        erro: "Assinatura inválida",
      })

      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
    }

    const webhook = JSON.parse(rawBody)

    console.log("[Webhook] Evento recebido:", webhook.type)

    await registrarAuditoria({
      acao: "WEBHOOK_RECEBIDO",
      entidade: "Webhook",
      detalhes: { tipo: webhook.type, data: webhook.data },
      ipAddress,
      userAgent,
      sucesso: true,
    })

    // Processa apenas eventos de pagamento
    if (webhook.type !== "charge.paid") {
      return NextResponse.json({ received: true })
    }

    const charge = webhook.data
    const orderId = charge.order?.id

    if (!orderId) {
      console.error("[Webhook] Order ID não encontrado")
      return NextResponse.json({ error: "Order ID não encontrado" }, { status: 400 })
    }

    // Busca pedido no banco
    const pedido = await prisma.pedido.findFirst({
      where: { externalId: orderId },
    })

    if (!pedido) {
      console.error("[Webhook] Pedido não encontrado:", orderId)
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Atualiza status do pedido
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    })

    // Atualiza charge
    await prisma.charge.updateMany({
      where: { pedidoId: pedido.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    })

    console.log("[Webhook] Pagamento confirmado:", orderId)

    await registrarAuditoria({
      acao: "PAGAMENTO_PAGO",
      entidade: "Pedido",
      entidadeId: pedido.id,
      detalhes: {
        orderId,
        valor: pedido.valor,
        chargeId: charge.id,
      },
      ipAddress,
      userAgent,
      sucesso: true,
    })

    // Libera acesso no Mikrotik
    try {
      const mikrotik = new MikrotikClient()
      await mikrotik.liberarAcesso(pedido.clienteMac, pedido.clienteIp, pedido.tempoMinutos)

      // Cria sessão ativa
      await prisma.sessaoAtiva.create({
        data: {
          clienteMac: pedido.clienteMac,
          clienteIp: pedido.clienteIp,
          expiraEm: new Date(Date.now() + pedido.tempoMinutos * 60 * 1000),
          pedidoId: pedido.id,
        },
      })

      await prisma.pedido.update({
        where: { id: pedido.id },
        data: { liberadoAt: new Date() },
      })

      console.log("[Webhook] Acesso liberado no Mikrotik")

      await registrarAuditoria({
        acao: "ACESSO_LIBERADO",
        entidade: "Sessao",
        entidadeId: pedido.id,
        detalhes: {
          mac: pedido.clienteMac,
          ip: pedido.clienteIp,
          tempoMinutos: pedido.tempoMinutos,
        },
        ipAddress,
        userAgent,
        sucesso: true,
      })
    } catch (error) {
      console.error("[Webhook] Erro ao liberar acesso:", error)

      await registrarAuditoria({
        acao: "ACESSO_LIBERADO",
        entidade: "Sessao",
        entidadeId: pedido.id,
        detalhes: {
          mac: pedido.clienteMac,
          ip: pedido.clienteIp,
        },
        ipAddress,
        userAgent,
        sucesso: false,
        erro: error.message,
      })

      // Não retorna erro para não fazer o Pagar.me reenviar o webhook
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Webhook] Erro ao processar:", error)

    await registrarAuditoria({
      acao: "WEBHOOK_RECEBIDO",
      entidade: "Webhook",
      detalhes: { erro: error.message },
      ipAddress,
      userAgent,
      sucesso: false,
      erro: error.message,
    })

    return NextResponse.json({ error: "Erro ao processar webhook" }, { status: 500 })
  }
}

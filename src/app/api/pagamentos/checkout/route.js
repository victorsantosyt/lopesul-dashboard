import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import PagarMeClient from "@/lib/pagarme"

const prisma = new PrismaClient()
const pagarme = new PagarMeClient()

export async function POST(request) {
  try {
    const body = await request.json()
    const { macAddress, ipAddress, planoId } = body

    if (!macAddress || !ipAddress || !planoId) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    // Busca plano (assumindo que existe tabela de planos)
    // Se não existir, use valores fixos
    const plano = {
      id: planoId,
      nome: planoId === "1h" ? "1 Hora" : planoId === "3h" ? "3 Horas" : "24 Horas",
      valor: planoId === "1h" ? 500 : planoId === "3h" ? 1000 : 2000, // em centavos
      tempoMinutos: planoId === "1h" ? 60 : planoId === "3h" ? 180 : 1440,
    }

    // Gera ID externo único
    const externalId = `${Date.now()}-${macAddress.replace(/:/g, "")}`

    // Cria pedido no Pagar.me
    const pedidoPagarme = await pagarme.criarPedido({
      nome: "Cliente Hotspot",
      email: "cliente@hotspot.com",
      valor: plano.valor,
      descricao: `Internet - ${plano.nome}`,
      macAddress,
      ipAddress,
      tempoMinutos: plano.tempoMinutos,
      externalId,
    })

    // Salva pedido no banco
    const pedido = await prisma.pedido.create({
      data: {
        externalId: pedidoPagarme.id,
        macAddress,
        ipAddress,
        valor: plano.valor,
        descricao: plano.nome,
        tempoMinutos: plano.tempoMinutos,
        status: "pending",
        qrCode: pedidoPagarme.qrCode,
        qrCodeUrl: pedidoPagarme.qrCodeUrl,
        pixCopiaECola: pedidoPagarme.pixCopiaECola,
        expiresAt: new Date(pedidoPagarme.expiresAt),
      },
    })

    // Cria charge
    await prisma.charge.create({
      data: {
        pedidoId: pedido.id,
        externalId: pedidoPagarme.id,
        status: "pending",
        valor: plano.valor,
        metodoPagamento: "pix",
      },
    })

    return NextResponse.json({
      success: true,
      pedido: {
        id: pedido.id,
        externalId: pedido.externalId,
        qrCode: pedido.qrCode,
        qrCodeUrl: pedido.qrCodeUrl,
        pixCopiaECola: pedido.pixCopiaECola,
        valor: pedido.valor,
        tempoMinutos: pedido.tempoMinutos,
      },
    })
  } catch (error) {
    console.error("[Checkout] Erro:", error)
    return NextResponse.json({ error: "Erro ao criar pedido" }, { status: 500 })
  }
}

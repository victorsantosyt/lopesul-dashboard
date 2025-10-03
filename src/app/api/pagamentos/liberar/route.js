import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { liberarAcesso } from "@/lib/mikrotik"

const prisma = new PrismaClient()

export async function POST(request) {
  try {
    const { pedido_id } = await request.json()

    if (!pedido_id) {
      return NextResponse.json({ error: "pedido_id é obrigatório" }, { status: 400 })
    }

    // Buscar pedido
    const pedido = await prisma.pedido.findUnique({
      where: { id: pedido_id },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    if (pedido.status !== "paid") {
      return NextResponse.json({ error: "Pedido não está pago" }, { status: 400 })
    }

    // Buscar configuração de tempo de sessão
    const config = await prisma.configuracao.findFirst({
      where: { chave: "tempo_sessao_horas" },
    })
    const tempoSessao = config ? Number.parseInt(config.valor) : 24

    // Liberar acesso no Mikrotik
    const resultado = await liberarAcesso(pedido.mac_address, pedido.ip_address, tempoSessao)

    if (!resultado.success) {
      return NextResponse.json(
        { error: "Erro ao liberar acesso no Mikrotik", details: resultado.error },
        { status: 500 },
      )
    }

    // Criar sessão ativa
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + tempoSessao)

    await prisma.sessaoAtiva.create({
      data: {
        mac_address: pedido.mac_address,
        ip_address: pedido.ip_address,
        pedido_id: pedido.id,
        expires_at: expiresAt,
        status: "active",
      },
    })

    // Atualizar pedido
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        acesso_liberado: true,
        acesso_liberado_em: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: "Acesso liberado com sucesso",
      expires_at: expiresAt,
    })
  } catch (error) {
    console.error("[v0] Erro ao liberar acesso:", error)
    return NextResponse.json({ error: "Erro ao liberar acesso", details: error.message }, { status: 500 })
  }
}

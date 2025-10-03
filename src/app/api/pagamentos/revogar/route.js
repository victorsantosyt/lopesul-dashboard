import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { revogarAcesso } from "@/lib/mikrotik"
import { registrarAuditoria, extrairInfoRequisicao } from "@/lib/audit"

const prisma = new PrismaClient()

export async function POST(request) {
  const { ipAddress, userAgent } = extrairInfoRequisicao(request)

  try {
    const { pedido_id, mac_address } = await request.json()

    if (!pedido_id && !mac_address) {
      return NextResponse.json({ error: "pedido_id ou mac_address é obrigatório" }, { status: 400 })
    }

    // Buscar sessão ativa
    const where = pedido_id ? { pedidoId: pedido_id } : { clienteMac: mac_address, ativa: true }

    const sessao = await prisma.sessaoAtiva.findFirst({
      where,
      include: { pedido: true },
    })

    if (!sessao) {
      return NextResponse.json({ error: "Sessão ativa não encontrada" }, { status: 404 })
    }

    // Revogar acesso no Mikrotik
    const resultado = await revogarAcesso(sessao.clienteMac, sessao.clienteIp)

    if (!resultado.success) {
      console.error("[v0] Erro ao revogar no Mikrotik:", resultado.error)
    }

    // Atualizar sessão
    await prisma.sessaoAtiva.update({
      where: { id: sessao.id },
      data: {
        ativa: false,
        revogadaEm: new Date(),
      },
    })

    await registrarAuditoria({
      acao: "ACESSO_REVOGADO",
      entidade: "Sessao",
      entidadeId: sessao.id,
      detalhes: {
        pedidoId: sessao.pedidoId,
        mac: sessao.clienteMac,
        ip: sessao.clienteIp,
        mikrotikSuccess: resultado.success,
      },
      ipAddress,
      userAgent,
      sucesso: true,
    })

    return NextResponse.json({
      success: true,
      message: "Acesso revogado com sucesso",
      mikrotik_success: resultado.success,
    })
  } catch (error) {
    console.error("[v0] Erro ao revogar acesso:", error)

    await registrarAuditoria({
      acao: "ACESSO_REVOGADO",
      entidade: "Sessao",
      detalhes: { erro: error.message },
      ipAddress,
      userAgent,
      sucesso: false,
      erro: error.message,
    })

    return NextResponse.json({ error: "Erro ao revogar acesso", details: error.message }, { status: 500 })
  }
}

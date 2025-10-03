import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { revogarAcesso } from "@/lib/mikrotik"

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    // Verificar autorização (pode usar um token secreto)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET || "seu-token-secreto-aqui"

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const agora = new Date()
    const resultados = {
      sessoes_expiradas: 0,
      sessoes_revogadas: 0,
      pedidos_cancelados: 0,
      charges_expiradas: 0,
      erros: [],
    }

    // 1. Revogar sessões expiradas
    const sessoesExpiradas = await prisma.sessaoAtiva.findMany({
      where: {
        status: "active",
        expires_at: {
          lte: agora,
        },
      },
    })

    console.log(`[v0] Encontradas ${sessoesExpiradas.length} sessões expiradas`)

    for (const sessao of sessoesExpiradas) {
      try {
        // Revogar no Mikrotik
        const resultado = await revogarAcesso(sessao.mac_address, sessao.ip_address)

        // Atualizar no banco independente do resultado do Mikrotik
        await prisma.sessaoAtiva.update({
          where: { id: sessao.id },
          data: {
            status: "expired",
            revoked_at: agora,
          },
        })

        resultados.sessoes_expiradas++

        if (!resultado.success) {
          resultados.erros.push({
            tipo: "mikrotik",
            sessao_id: sessao.id,
            erro: resultado.error,
          })
        }
      } catch (error) {
        console.error(`[v0] Erro ao revogar sessão ${sessao.id}:`, error)
        resultados.erros.push({
          tipo: "sessao",
          sessao_id: sessao.id,
          erro: error.message,
        })
      }
    }

    // 2. Cancelar pedidos pendentes há mais de 24 horas
    const umDiaAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000)

    const pedidosCancelados = await prisma.pedido.updateMany({
      where: {
        status: "pending",
        created_at: {
          lte: umDiaAtras,
        },
      },
      data: {
        status: "canceled",
        updated_at: agora,
      },
    })

    resultados.pedidos_cancelados = pedidosCancelados.count

    // 3. Marcar charges expiradas
    const chargesExpiradas = await prisma.charge.updateMany({
      where: {
        status: "pending",
        expires_at: {
          lte: agora,
        },
      },
      data: {
        status: "expired",
        updated_at: agora,
      },
    })

    resultados.charges_expiradas = chargesExpiradas.count

    // 4. Limpar dados antigos (opcional - pedidos cancelados há mais de 90 dias)
    const trintaDiasAtras = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000)

    // Deletar charges antigas primeiro (foreign key)
    await prisma.charge.deleteMany({
      where: {
        pedido: {
          status: "canceled",
          created_at: {
            lte: trintaDiasAtras,
          },
        },
      },
    })

    // Deletar pedidos cancelados antigos
    const pedidosDeletados = await prisma.pedido.deleteMany({
      where: {
        status: "canceled",
        created_at: {
          lte: trintaDiasAtras,
        },
      },
    })

    resultados.pedidos_deletados = pedidosDeletados.count

    console.log("[v0] Limpeza automática concluída:", resultados)

    return NextResponse.json({
      success: true,
      message: "Limpeza automática executada com sucesso",
      resultados,
      executado_em: agora.toISOString(),
    })
  } catch (error) {
    console.error("[v0] Erro na limpeza automática:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao executar limpeza automática",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

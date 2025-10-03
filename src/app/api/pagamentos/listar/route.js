import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const status = searchParams.get("status")
    const dataInicio = searchParams.get("data_inicio")
    const dataFim = searchParams.get("data_fim")
    const macAddress = searchParams.get("mac_address")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    // Construir filtros
    const where = {}

    if (status) {
      where.status = status
    }

    if (macAddress) {
      where.mac_address = { contains: macAddress }
    }

    if (dataInicio || dataFim) {
      where.created_at = {}
      if (dataInicio) {
        where.created_at.gte = new Date(dataInicio)
      }
      if (dataFim) {
        where.created_at.lte = new Date(dataFim)
      }
    }

    // Buscar pedidos com paginação
    const [pedidos, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        include: {
          charges: {
            orderBy: { created_at: "desc" },
            take: 1,
          },
          sessoes: {
            orderBy: { created_at: "desc" },
            take: 1,
          },
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pedido.count({ where }),
    ])

    return NextResponse.json({
      pedidos: pedidos.map((p) => ({
        id: p.id,
        status: p.status,
        valor: p.valor,
        mac_address: p.mac_address,
        ip_address: p.ip_address,
        acesso_liberado: p.acesso_liberado,
        acesso_liberado_em: p.acesso_liberado_em,
        ultima_charge: p.charges[0] || null,
        sessao_ativa: p.sessoes[0] || null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("[v0] Erro ao listar pagamentos:", error)
    return NextResponse.json({ error: "Erro ao listar pagamentos", details: error.message }, { status: 500 })
  }
}

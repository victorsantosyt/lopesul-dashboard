import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const dataInicio = searchParams.get("data_inicio")
    const dataFim = searchParams.get("data_fim")
    const formato = searchParams.get("formato") || "json" // json ou csv

    // Construir filtros
    const where = {}

    if (dataInicio || dataFim) {
      where.created_at = {}
      if (dataInicio) {
        where.created_at.gte = new Date(dataInicio)
      }
      if (dataFim) {
        where.created_at.lte = new Date(dataFim)
      }
    }

    // Buscar estatísticas
    const [totalPedidos, pedidosPagos, pedidosPendentes, pedidosCancelados, valorTotal, pedidos] = await Promise.all([
      prisma.pedido.count({ where }),
      prisma.pedido.count({ where: { ...where, status: "paid" } }),
      prisma.pedido.count({ where: { ...where, status: "pending" } }),
      prisma.pedido.count({ where: { ...where, status: "canceled" } }),
      prisma.pedido.aggregate({
        where: { ...where, status: "paid" },
        _sum: { valor: true },
      }),
      prisma.pedido.findMany({
        where,
        include: {
          charges: {
            orderBy: { created_at: "desc" },
            take: 1,
          },
        },
        orderBy: { created_at: "desc" },
      }),
    ])

    const relatorio = {
      periodo: {
        inicio: dataInicio || "início",
        fim: dataFim || "agora",
      },
      estatisticas: {
        total_pedidos: totalPedidos,
        pedidos_pagos: pedidosPagos,
        pedidos_pendentes: pedidosPendentes,
        pedidos_cancelados: pedidosCancelados,
        valor_total: valorTotal._sum.valor || 0,
        taxa_conversao: totalPedidos > 0 ? ((pedidosPagos / totalPedidos) * 100).toFixed(2) + "%" : "0%",
      },
      pedidos: pedidos.map((p) => ({
        id: p.id,
        status: p.status,
        valor: p.valor,
        mac_address: p.mac_address,
        ip_address: p.ip_address,
        acesso_liberado: p.acesso_liberado,
        metodo_pagamento: p.charges[0]?.payment_method || "N/A",
        created_at: p.created_at,
        paid_at: p.charges[0]?.paid_at || null,
      })),
    }

    // Retornar CSV se solicitado
    if (formato === "csv") {
      const csv = [
        "ID,Status,Valor,MAC Address,IP Address,Acesso Liberado,Método Pagamento,Criado Em,Pago Em",
        ...relatorio.pedidos.map(
          (p) =>
            `${p.id},${p.status},${p.valor},${p.mac_address},${p.ip_address},${p.acesso_liberado},${p.metodo_pagamento},${p.created_at},${p.paid_at || "N/A"}`,
        ),
      ].join("\n")

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="relatorio-pagamentos-${Date.now()}.csv"`,
        },
      })
    }

    return NextResponse.json(relatorio)
  } catch (error) {
    console.error("[v0] Erro ao gerar relatório:", error)
    return NextResponse.json({ error: "Erro ao gerar relatório", details: error.message }, { status: 500 })
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// totals “gerais” e do período recente
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") || "30");
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);

    // Pagamentos (String status: 'pago' | 'pendente' | 'expirado')
    const [pagos, pendentes, expirados, receitaAgg] = await Promise.all([
      prisma.pagamento.count({ where: { status: "pago",   criadoEm: { gte: from, lte: to } } }),
      prisma.pagamento.count({ where: { status: "pendente", criadoEm: { gte: from, lte: to } } }),
      prisma.pagamento.count({ where: { status: "expirado", criadoEm: { gte: from, lte: to } } }),
      prisma.pagamento.aggregate({
        _sum: { valor: true },
        where: { status: "pago", criadoEm: { gte: from, lte: to } },
      }),
    ]);

    // Vendas (se usar Venda como seu “checkout”/faturamento)
    const vendasAgg = await prisma.venda.aggregate({
      _sum: { valor: true },
      _count: { id: true },
      where: { data: { gte: from, lte: to } },
    });

    // Inventário / Operação
    const [frotas, dispositivos, operadores, sessoesAtivas] = await Promise.all([
      prisma.frota.count(),
      prisma.dispositivo.count(),
      prisma.operador.count(),
      prisma.sessaoAtiva.count({ where: { ativo: true } }),
    ]);

    return NextResponse.json({
      periodo: { from, to, days },
      kpis: {
        totalVendas: vendasAgg._sum.valor || 0,
        qtdVendas: vendasAgg._count.id || 0,
        receita: receitaAgg._sum.valor || 0,
        pagamentos: { pagos, pendentes, expirados },
      },
      inventario: { frotas, dispositivos },
      operacao: { operadores, sessoesAtivas },
    });
  } catch (e) {
    console.error("API /dashboard erro:", e);
    return NextResponse.json({ error: "Erro no dashboard" }, { status: 500 });
  }
}

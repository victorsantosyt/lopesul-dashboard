// src/app/api/dashboard/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") || "30");

    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);

    // helpers
    const between = { gte: from, lte: to };
    const safeNum = (n) => (Number.isFinite(n) ? n : 0);

    // ----- Pagamentos -----
    let pagos = 0, pendentes = 0, expirados = 0, receitaCent = 0;

    try {
      [pagos, pendentes, expirados] = await Promise.all([
        prisma.pagamento.count({ where: { status: "pago",     criadoEm: between } }),
        prisma.pagamento.count({ where: { status: "pendente", criadoEm: between } }),
        prisma.pagamento.count({ where: { status: "expirado", criadoEm: between } }),
      ]);

      const agg = await prisma.pagamento.aggregate({
        _sum: { valorCent: true },
        where: { status: "pago", criadoEm: between },
      });
      receitaCent = safeNum(agg._sum.valorCent || 0);
    } catch {
      // se a tabela ainda não existir, ignora e segue com zeros
    }

    // ----- Vendas -----
    let totalVendas = 0;
    let qtdVendas = 0;
    try {
      const vendasAgg = await prisma.venda.aggregate({
        _sum:   { valorCent: true }, // ✅ trocar de valor → valorCent
        _count: { id: true },
        where:  { data: between },
      });
      totalVendas = safeNum(vendasAgg._sum.valorCent || 0) / 100; // centavos → R$
      qtdVendas   = safeNum(vendasAgg._count.id || 0);
    } catch {
      // idem: sem tabela, retorna 0
    }

    // ----- Inventário / Operação -----
    let frotas = 0, dispositivos = 0, operadores = 0, sessoesAtivas = 0;
    try {
      [frotas, dispositivos, operadores, sessoesAtivas] = await Promise.all([
        prisma.frota.count(),
        prisma.dispositivo.count(),
        prisma.operador.count(),
        prisma.sessaoAtiva.count({ where: { ativo: true } }),
      ]);
    } catch {}

    return NextResponse.json({
      periodo: { from, to, days },
      kpis: {
        totalVendas,                // já em R$
        qtdVendas,
        receita: receitaCent / 100, // pagos em R$
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

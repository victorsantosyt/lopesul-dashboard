// src/app/api/dashboard/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const daysRaw = Number(searchParams.get("days") || "30");
    const days = Math.min(Math.max(daysRaw, 1), 365); // 1..365

    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);

    const between = { gte: from, lte: to };
    const safeNum = (n) => (Number.isFinite(n) ? n : 0);

    // ---------- Pagamentos (1 query com groupBy) ----------
    // retorna linhas por status com _count e _sum.valorCent
    const pgRows =
      (await prisma.pagamento
        .groupBy({
          by: ["status"],
          where: { criadoEm: between },
          _count: { _all: true },
          _sum: { valorCent: true },
        })
        .catch(() => [])) || [];

    let pagos = 0,
      pendentes = 0,
      expirados = 0,
      receitaCent = 0;

    for (const r of pgRows) {
      const st = r.status;
      const cnt = safeNum(r._count?._all || 0);
      const sum = safeNum(r._sum?.valorCent || 0);
      if (st === "pago") {
        pagos += cnt;
        receitaCent += sum;
      } else if (st === "pendente") {
        pendentes += cnt;
      } else if (st === "expirado") {
        expirados += cnt;
      }
    }

    // ---------- Vendas (1 query) ----------
    let totalVendas = 0;
    let qtdVendas = 0;
    try {
      const vendasAgg = await prisma.venda.aggregate({
        _sum: { valorCent: true }, // campo em centavos
        _count: { id: true },
        where: { data: between },
      });
      totalVendas = safeNum(vendasAgg._sum?.valorCent || 0) / 100; // centavos → R$
      qtdVendas = safeNum(vendasAgg._count?.id || 0);
    } catch {
      // se não existir a tabela, segue com zeros
    }

    // ---------- Inventário / Operação (1 roundtrip usando $transaction) ----------
    const [frotas, dispositivos, operadores, sessoesAtivas] = await prisma.$transaction([
      prisma.frota.count(),
      prisma.dispositivo.count(),
      prisma.operador.count(),
      prisma.sessaoAtiva.count({ where: { ativo: true } }),
    ]);

    const payload = {
      periodo: { from, to, days },
      kpis: {
        totalVendas,                // R$
        qtdVendas,
        receita: receitaCent / 100, // R$
        pagamentos: { pagos, pendentes, expirados },
      },
      inventario: { frotas, dispositivos },
      operacao: { operadores, sessoesAtivas },
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("API /dashboard erro:", e);
    return NextResponse.json({ error: "Erro no dashboard" }, { status: 500 });
  }
}

// src/app/api/dashboard/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    // ----- período -----
    const { searchParams } = new URL(req.url);
    const daysRaw = Number(searchParams.get("days") || "30");
    const days = Math.min(Math.max(daysRaw, 1), 365); // 1..365
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    const between = { gte: from, lte: to };

    const safeNum = (n) => (Number.isFinite(n) ? n : 0);

    // helpers “silenciosos”
    const hasModel = (name) => {
      // prisma é um proxy; checagem segura:
      const m = prisma?.[name];
      return !!m && typeof m === "object";
    };
    const q = async (fn, fallback) => {
      try { return await fn(); } catch { return fallback; }
    };

    // =====================================================================
    // 1) PAGAMENTOS / RECEITA
    //    Preferimos modelo novo: PEDIDO (status + valorCent + createdAt)
    //    Se não houver, tentamos legado: PAGAMENTO (status + valorCent + criadoEm)
    // =====================================================================
    let pagos = 0, pendentes = 0, expirados = 0, receitaCent = 0;

    if (hasModel("pedido") && typeof prisma.pedido.groupBy === "function") {
      const rows = await q(() => prisma.pedido.groupBy({
        by: ["status"],
        where: { createdAt: between },
        _count: { _all: true },
        // só soma se existir o campo no schema; se não existir, Prisma ignora? então protegemos no consumo
        _sum: { valorCent: true },
      }), []);

      for (const r of rows) {
        const st = r.status;
        const cnt = safeNum(r?._count?._all || 0);
        const sum = safeNum(r?._sum?.valorCent || 0);
        if (st === "PAID" || st === "pago") {
          pagos += cnt; receitaCent += sum;
        } else if (st === "PENDING" || st === "pendente") {
          pendentes += cnt;
        } else if (st === "EXPIRED" || st === "expirado") {
          expirados += cnt;
        }
      }
    } else if (hasModel("pagamento") && typeof prisma.pagamento.groupBy === "function") {
      const rows = await q(() => prisma.pagamento.groupBy({
        by: ["status"],
        where: { criadoEm: between },
        _count: { _all: true },
        _sum: { valorCent: true },
      }), []);

      for (const r of rows) {
        const st = r.status;
        const cnt = safeNum(r?._count?._all || 0);
        const sum = safeNum(r?._sum?.valorCent || 0);
        if (st === "pago" || st === "PAID") {
          pagos += cnt; receitaCent += sum;
        } else if (st === "pendente" || st === "PENDING") {
          pendentes += cnt;
        } else if (st === "expirado" || st === "EXPIRED") {
          expirados += cnt;
        }
      }
    }
    // caso nenhum modelo exista: ficam zeros

    // =====================================================================
    // 2) VENDAS (agregados)
    // =====================================================================
    let totalVendas = 0;
    let qtdVendas = 0;
    if (hasModel("venda")) {
      const ag = await q(() => prisma.venda.aggregate({
        _sum: { valorCent: true },
        _count: { id: true },
        where: { data: between },
      }), { _sum: { valorCent: 0 }, _count: { id: 0 } });

      totalVendas = safeNum(ag._sum?.valorCent || 0) / 100;
      qtdVendas   = safeNum(ag._count?.id || 0);
    }

    // =====================================================================
    // 3) INVENTÁRIO / OPERAÇÃO (counts)
    // =====================================================================
    const counts = await q(async () => {
      const tasks = [];

      // só empurra o que existir; mantém ordem para ler depois
      if (hasModel("frota"))        tasks.push(prisma.frota.count());
      if (hasModel("dispositivo"))  tasks.push(prisma.dispositivo.count());
      if (hasModel("operador"))     tasks.push(prisma.operador.count());
      if (hasModel("sessaoAtiva"))  tasks.push(prisma.sessaoAtiva.count({ where: { ativo: true } }));

      const res = await prisma.$transaction(tasks);

      // map por posição, mas caindo pra 0 se ausente
      let i = 0;
      const frotas        = tasks.length > i ? res[i++] : 0;
      const dispositivos  = tasks.length > i ? res[i++] : 0;
      const operadores    = tasks.length > i ? res[i++] : 0;
      const sessoesAtivas = tasks.length > i ? res[i++] : 0;

      return { frotas, dispositivos, operadores, sessoesAtivas };
    }, { frotas: 0, dispositivos: 0, operadores: 0, sessoesAtivas: 0 });

    // =====================================================================
    // 4) RESPOSTA
    // =====================================================================
    const payload = {
      periodo: { from, to, days },
      kpis: {
        totalVendas,                // R$
        qtdVendas,
        receita: receitaCent / 100, // R$
        pagamentos: { pagos, pendentes, expirados },
      },
      inventario: { frotas: counts.frotas, dispositivos: counts.dispositivos },
      operacao: { operadores: counts.operadores, sessoesAtivas: counts.sessoesAtivas },
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

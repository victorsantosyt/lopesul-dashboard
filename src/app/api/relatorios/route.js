// src/app/api/relatorios/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Helpers
const toNumber = (v) => Number(v || 0);
const ymd = (d) => d.toISOString().slice(0, 10);
const isYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const atStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const atEndOfDay   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

// Gera array de dias "YYYY-MM-DD" inclusivo
function rangeDays(startDate, endDate) {
  const out = [];
  const cur = atStartOfDay(startDate);
  const end = atEndOfDay(endDate);
  for (let d = new Date(cur); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(ymd(new Date(d)));
  }
  return out;
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const fromQ = url.searchParams.get('from'); // YYYY-MM-DD
    const toQ   = url.searchParams.get('to');   // YYYY-MM-DD

    // Default: últimos 30 dias (inclui hoje)
    const today = new Date();
    let start = new Date(today);
    start.setDate(start.getDate() - 29);
    start = atStartOfDay(start);
    let end = atEndOfDay(today);

    // Se vierem parâmetros válidos, usa-os
    if (fromQ && !isYMD(fromQ)) {
      return NextResponse.json({ error: 'Parâmetro "from" inválido. Use YYYY-MM-DD.' }, { status: 400 });
    }
    if (toQ && !isYMD(toQ)) {
      return NextResponse.json({ error: 'Parâmetro "to" inválido. Use YYYY-MM-DD.' }, { status: 400 });
    }
    if (fromQ) start = atStartOfDay(new Date(fromQ));
    if (toQ)   end   = atEndOfDay(new Date(toQ));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Datas inválidas.' }, { status: 400 });
    }
    if (start > end) {
      return NextResponse.json({ error: '"from" deve ser anterior ou igual a "to".' }, { status: 400 });
    }

    // (Opcional) limite de intervalo p/ evitar consultas gigantes
    const MAX_DAYS = 185; // ~6 meses
    const daysDiff = Math.ceil((atStartOfDay(end) - atStartOfDay(start)) / (1000*60*60*24)) + 1;
    if (daysDiff > MAX_DAYS) {
      return NextResponse.json({ error: `Intervalo muito grande. Máximo de ${MAX_DAYS} dias.` }, { status: 400 });
    }

    // Base de dias para séries
    const dias = rangeDays(start, end);

    // Coletas em paralelo
    const [
      frotas,
      dispositivosCount,
      operadoresCount,
      sessoesAtivasCount,

      vendasPeriodo,             // vendas dentro do período
      pagamentosPeriodo,         // pagamentos dentro do período (para séries/valores)
      vendasPorFrotaPeriodoAgg,  // soma por frota dentro do período

      // Totais globais (inventário) ficam fora do período; mas totais financeiros abaixo são do período
    ] = await Promise.all([
      prisma.frota.findMany({
        orderBy: { criadoEm: 'desc' },
        include: { _count: { select: { dispositivos: true } } },
      }),
      prisma.dispositivo.count(),
      prisma.operador.count(),
      prisma.sessaoAtiva.count({ where: { ativo: true } }),

      prisma.venda.findMany({
        where: { data: { gte: start, lte: end } },
      }),
      prisma.pagamento.findMany({
        where: { criadoEm: { gte: start, lte: end } }, // usamos criadoEm p/ série; status filtra abaixo
      }),
      prisma.venda.groupBy({
        by: ['frotaId'],
        where: { data: { gte: start, lte: end } },
        _sum: { valor: true },
      }),
    ]);

    // Resumo financeiro do período
    const [vendasAggPeriodo, pagosAggPeriodo, qtdPagos, qtdPendentes, qtdExpirados] = await Promise.all([
      prisma.venda.aggregate({
        _sum: { valor: true },
        _count: { _all: true },
        where: { data: { gte: start, lte: end } },
      }),
      prisma.pagamento.aggregate({
        _sum: { valor: true },
        where: { status: 'pago', pagoEm: { gte: start, lte: end } },
      }),
      prisma.pagamento.count({ where: { status: 'pago',  pagoEm:   { gte: start, lte: end } } }),
      prisma.pagamento.count({ where: { status: 'pendente', criadoEm: { gte: start, lte: end } } }),
      prisma.pagamento.count({ where: { status: 'expirado', criadoEm: { gte: start, lte: end } } }),
    ]);

    // Séries diárias (vendas e pagamentos pagos) dentro do período
    const vendasMap = new Map(dias.map(k => [k, 0]));
    for (const v of vendasPeriodo) {
      const k = ymd(new Date(v.data));
      vendasMap.set(k, toNumber(vendasMap.get(k)) + toNumber(v.valor));
    }
    const vendasPorDia = dias.map(k => ({ dia: k, vendas: vendasMap.get(k) || 0 }));

    // Para pagamentos, somamos somente os "pago" no dia do pagamento (pagoEm). Se não houver pagoEm, cai fora.
    const pagosMap = new Map(dias.map(k => [k, 0]));
    for (const p of pagamentosPeriodo) {
      if (p.status !== 'pago' || !p.pagoEm) continue;
      const k = ymd(new Date(p.pagoEm));
      if (k >= ymd(start) && k <= ymd(end)) {
        pagosMap.set(k, toNumber(pagosMap.get(k)) + toNumber(p.valor));
      }
    }
    const pagamentosPorDia = dias.map(k => ({ dia: k, pagos: pagosMap.get(k) || 0 }));

    // Faturamento por frota (no período)
    const somaPorFrota = new Map(
      vendasPorFrotaPeriodoAgg.map(v => [v.frotaId, toNumber(v._sum.valor)])
    );
    const porFrota = frotas
      .map(f => ({
        id: f.id,
        nome: f.nome ?? `Frota ${f.id.slice(0, 4)}`, // fallback (se depois adicionar nome no schema, usa aqui)
        valor: somaPorFrota.get(f.id) || 0,
        dispositivos: f._count?.dispositivos || 0,
        status: (f._count?.dispositivos || 0) > 0 ? 'desconhecido' : 'offline',
      }))
      .sort((a, b) => b.valor - a.valor);

    const resposta = {
      periodo: { // devolvemos as datas finais usadas (útil pra UI)
        from: ymd(start),
        to: ymd(end),
        days: dias.length,
      },
      resumo: {
        totalVendas: toNumber(vendasAggPeriodo._sum.valor),
        qtdVendas: vendasAggPeriodo._count._all,

        totalPagos: toNumber(pagosAggPeriodo._sum.valor),
        qtdPagos,
        qtdPendentes,
        qtdExpirados,

        frotasCount: frotas.length,
        dispositivosCount,
        operadoresCount,
        sessoesAtivasCount,
      },
      series: {
        vendasPorDia,
        pagamentosPorDia,
      },
      porFrota,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    console.error('GET /api/relatorios', e);
    return NextResponse.json({ error: 'Erro ao montar relatórios' }, { status: 500 });
  }
}

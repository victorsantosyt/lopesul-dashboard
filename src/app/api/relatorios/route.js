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

    // Default: últimos 30 dias
    const today = new Date();
    let start = new Date(today);
    start.setDate(start.getDate() - 29);
    start = atStartOfDay(start);
    let end = atEndOfDay(today);

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

    // Limite de intervalo
    const MAX_DAYS = 185;
    const daysDiff = Math.ceil((atStartOfDay(end) - atStartOfDay(start)) / (1000*60*60*24)) + 1;
    if (daysDiff > MAX_DAYS) {
      return NextResponse.json({ error: `Intervalo muito grande. Máximo de ${MAX_DAYS} dias.` }, { status: 400 });
    }

    const dias = rangeDays(start, end);

    // Coletas em paralelo
    const [
      frotas,
      dispositivosCount,
      operadoresCount,
      sessoesAtivasCount,

      vendasPeriodo,                    // Vendas no período (valor em centavos)
      pedidosPagoPeriodo,               // Pedidos pagos no período (considera updatedAt)
      vendasPorFrotaPeriodoAgg,         // Soma de vendas por frota no período

      vendasAggPeriodo,                 // Agregado de vendas (período)
      pedidosPagoAggPeriodo,            // Soma de pedidos pagos (período)
      qtdPagos,
      qtdPendentes,
      qtdExpirados,
    ] = await Promise.all([
      // Frotas + count dispositivos (inventário, não filtra por período)
      prisma.frota.findMany({
        orderBy: { criadoEm: 'desc' },
        include: { _count: { select: { dispositivos: true } } },
      }).catch(() => []),

      prisma.dispositivo.count().catch(() => 0),
      prisma.operador.count().catch(() => 0),
      prisma.sessaoAtiva.count({ where: { ativo: true } }).catch(() => 0),

      // Vendas (usar campos reais: data, valorCent)
      prisma.venda.findMany({
        where: { data: { gte: start, lte: end } },
        select: { data: true, valorCent: true, frotaId: true },
      }).catch(() => []),

      // Pedidos pagos (usar Pedido/PaymentStatus=PAID, updatedAt)
      prisma.pedido.findMany({
        where: { status: 'PAID', updatedAt: { gte: start, lte: end } },
        select: { updatedAt: true, amount: true },
      }).catch(() => []),

      // Soma de vendas por frota (valorCent)
      prisma.venda.groupBy({
        by: ['frotaId'],
        where: { data: { gte: start, lte: end } },
        _sum: { valorCent: true },
      }).catch(() => []),

      // Agregados
      prisma.venda.aggregate({
        _sum: { valorCent: true },
        _count: { _all: true },
        where: { data: { gte: start, lte: end } },
      }).catch(() => ({ _sum: { valorCent: 0 }, _count: { _all: 0 } })),

      prisma.pedido.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', updatedAt: { gte: start, lte: end } },
      }).catch(() => ({ _sum: { amount: 0 } })),

      prisma.pedido.count({
        where: { status: 'PAID', updatedAt: { gte: start, lte: end } },
      }).catch(() => 0),

      prisma.pedido.count({
        where: { status: 'PENDING', createdAt: { gte: start, lte: end } },
      }).catch(() => 0),

      prisma.pedido.count({
        where: { status: 'EXPIRED', createdAt: { gte: start, lte: end } },
      }).catch(() => 0),
    ]);

    // Séries diárias — Vendas (converter centavos -> reais)
    const vendasMap = new Map(dias.map(k => [k, 0]));
    for (const v of vendasPeriodo) {
      const k = ymd(new Date(v.data));
      vendasMap.set(k, toNumber(vendasMap.get(k)) + toNumber(v.valorCent) / 100);
    }
    const vendasPorDia = dias.map(k => ({ dia: k, vendas: vendasMap.get(k) || 0 }));

    // Séries diárias — Pagamentos (Pedidos pagos) (amount em centavos -> reais)
    const pagosMap = new Map(dias.map(k => [k, 0]));
    for (const p of pedidosPagoPeriodo) {
      const k = ymd(new Date(p.updatedAt));
      pagosMap.set(k, toNumber(pagosMap.get(k)) + toNumber(p.amount) / 100);
    }
    const pagamentosPorDia = dias.map(k => ({ dia: k, pagos: pagosMap.get(k) || 0 }));

    // Faturamento por frota (no período, usando Vendas)
    const somaPorFrota = new Map(
      (vendasPorFrotaPeriodoAgg || []).map(v => [v.frotaId, toNumber(v._sum?.valorCent) / 100])
    );
    const porFrota = (frotas || [])
      .map(f => ({
        id: f.id,
        nome: f.nome ?? `Frota ${f.id.slice(0, 4)}`,
        valor: somaPorFrota.get(f.id) || 0, // em reais
        dispositivos: f._count?.dispositivos || 0,
        status: (f._count?.dispositivos || 0) > 0 ? 'desconhecido' : 'offline',
      }))
      .sort((a, b) => b.valor - a.valor);

    const totalVendasReais = toNumber(vendasAggPeriodo._sum?.valorCent) / 100;
    const totalPagosReais  = toNumber(pedidosPagoAggPeriodo._sum?.amount) / 100;

    const resposta = {
      periodo: { from: ymd(start), to: ymd(end), days: dias.length },
      resumo: {
        totalVendas: totalVendasReais,
        qtdVendas: vendasAggPeriodo._count?._all || 0,

        totalPagos: totalPagosReais,
        qtdPagos,
        qtdPendentes,
        qtdExpirados,

        frotasCount: frotas?.length || 0,
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

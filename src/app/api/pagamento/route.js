// src/app/api/pagamentos/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// helpers de data
const isYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const atStart = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const atEnd   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const ymd     = (d) => d.toISOString().slice(0,10);

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const fromQ   = url.searchParams.get('from');
    const toQ     = url.searchParams.get('to');
    const q       = url.searchParams.get('q')?.trim();
    const statusQ = url.searchParams.get('status')?.toLowerCase(); // 'pago' | 'pendente' | 'expirado' | undefined

    // período padrão: últimos 30 dias
    const today = new Date();
    let start = new Date(today); start.setDate(start.getDate() - 29); start = atStart(start);
    let end   = atEnd(today);

    if (fromQ) {
      if (!isYMD(fromQ)) return NextResponse.json({ error: 'from inválido (YYYY-MM-DD)' }, { status: 400 });
      start = atStart(new Date(fromQ));
    }
    if (toQ) {
      if (!isYMD(toQ)) return NextResponse.json({ error: 'to inválido (YYYY-MM-DD)' }, { status: 400 });
      end = atEnd(new Date(toQ));
    }
    if (start > end) return NextResponse.json({ error: '"from" > "to"' }, { status: 400 });

    // limita a janelona (proteção)
    const MAX_DAYS = 185;
    const days = Math.ceil((atStart(end) - atStart(start)) / (1000*60*60*24)) + 1;
    if (days > MAX_DAYS) {
      return NextResponse.json({ error: `Intervalo muito grande. Máx: ${MAX_DAYS} dias.` }, { status: 400 });
    }

    const whereAND = [];

    // período: consideramos registros tocados no período
    // - pagos: pelo campo pagoEm
    // - demais (pendente/expirado): pelo criadoEm
    // Para não perder nada, usamos OR em cima dos dois carimbos de data
    whereAND.push({
      OR: [
        { criadoEm: { gte: start, lte: end } },
        { pagoEm:   { gte: start, lte: end } },
      ]
    });

    if (statusQ && ['pago','pendente','expirado'].includes(statusQ)) {
      whereAND.push({ status: statusQ });
    }

    if (q) {
      whereAND.push({
        OR: [
          { descricao: { contains: q, mode: 'insensitive' } },
          { plano:     { contains: q, mode: 'insensitive' } },
          { mac:       { contains: q, mode: 'insensitive' } },
          { ip:        { contains: q, mode: 'insensitive' } },
          { roteador:  { contains: q, mode: 'insensitive' } },
        ]
      });
    }

    const pagamentos = await prisma.pagamento.findMany({
      where: { AND: whereAND },
      orderBy: [{ pagoEm: 'desc' }, { criadoEm: 'desc' }],
      // se quiser paginação: take/skip aqui
    });

    const rows = pagamentos.map(p => ({
      id: p.id,
      descricao: p.descricao,
      plano: p.plano,
      valor: Number(p.valor || 0),
      forma: 'PIX',
      status: p.status?.toLowerCase() || 'pendente',
      data: (p.pagoEm ?? p.criadoEm),
      mac: p.mac,
      ip: p.ip,
      roteador: p.roteador,
    }));

    // pequenos agregados do período (úteis pra header da página)
    const tot = rows.reduce((acc, r) => {
      acc.totalReg += 1;
      if (r.status === 'pago') { acc.qtdPagos += 1; acc.totalPagos += r.valor; }
      else if (r.status === 'pendente') acc.qtdPend += 1;
      else if (r.status === 'expirado') acc.qtdExp += 1;
      return acc;
    }, { totalReg: 0, qtdPagos: 0, totalPagos: 0, qtdPend: 0, qtdExp: 0 });

    return NextResponse.json({
      periodo: { from: ymd(start), to: ymd(end), days },
      resumo: {
        totalReg: tot.totalReg,
        qtdPagos: tot.qtdPagos,
        qtdPendentes: tot.qtdPend,
        qtdExpirados: tot.qtdExp,
        totalPagos: tot.totalPagos,
      },
      itens: rows,
    });
  } catch (e) {
    console.error('GET /api/pagamentos', e);
    return NextResponse.json({ error: 'Erro ao listar pagamentos' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Janela padrão de busca quando não há externalId/txid
const DEFAULT_LOOKBACK_MINUTES = 120;

function toCents(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      externalId,   // preferencial
      txid,         // alternativa
      valor,        // fallback em reais
      descricao,    // fallback
      clienteIp,    // opcional p/ desambiguar no fallback
      lookbackMin,  // opcional, padrão 120 min
    } = body || {};

    // 1) Caminho preferido: localizar por externalId
    if (externalId) {
      const pg = await prisma.pagamento.findUnique({
        where: { externalId },
        select: {
          id: true,
          status: true,
          txid: true,
          externalId: true,
          valorCent: true,
          descricao: true,
          criadoEm: true,
          atualizadoEm: true,
        },
      });
      if (!pg) return NextResponse.json({ encontrado: false, pago: false, status: 'desconhecido' });

      return NextResponse.json({
        encontrado: true,
        pagamentoId: pg.id,
        status: pg.status,
        pago: pg.status === 'pago',
        externalId: pg.externalId,
        txid: pg.txid,
      });
    }

    // 2) Alternativa: localizar por txid
    if (txid) {
      const pg = await prisma.pagamento.findFirst({
        where: { txid },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          status: true,
          txid: true,
          externalId: true,
        },
      });
      if (!pg) return NextResponse.json({ encontrado: false, pago: false, status: 'desconhecido' });

      return NextResponse.json({
        encontrado: true,
        pagamentoId: pg.id,
        status: pg.status,
        pago: pg.status === 'pago',
        externalId: pg.externalId,
        txid: pg.txid,
      });
    }

    // 3) Fallback: valor + descricao (+ clienteIp), em janela recente
    const valorCent = toCents(valor);
    if (valorCent == null || !descricao) {
      return NextResponse.json(
        { error: 'Informe externalId, txid, ou (valor + descricao) para verificar.' },
        { status: 400 }
      );
    }

    const minutes = Number.isFinite(Number(lookbackMin)) ? Number(lookbackMin) : DEFAULT_LOOKBACK_MINUTES;
    const from = new Date(Date.now() - minutes * 60 * 1000);

    const where = {
      valorCent,
      descricao,
      criadoEm: { gte: from },
      ...(clienteIp ? { clienteIp } : {}),
    };

    const pg = await prisma.pagamento.findFirst({
      where,
      orderBy: [{ status: 'desc' }, { criadoEm: 'desc' }], // dá preferência a pagos; depois o mais novo
      select: {
        id: true,
        status: true,
        txid: true,
        externalId: true,
      },
    });

    if (!pg) {
      return NextResponse.json({ encontrado: false, pago: false, status: 'desconhecido' });
    }

    return NextResponse.json({
      encontrado: true,
      pagamentoId: pg.id,
      status: pg.status,
      pago: pg.status === 'pago',
      externalId: pg.externalId,
      txid: pg.txid,
    });
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

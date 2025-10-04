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
      externalId,   // preferencial (Pedido.code)
      txid,         // alternativa (Charge.providerId)
      valor,        // fallback em reais
      descricao,    // fallback
      clienteIp,    // opcional p/ desambiguar no fallback
      lookbackMin,  // opcional, padrão 120 min
    } = body || {};

    // 1) Caminho preferido: localizar por externalId (Pedido.code)
    if (externalId) {
      const pedido = await prisma.pedido.findUnique({
        where: { code: externalId },
        select: {
          id: true,
          status: true,
          code: true,
          charges: {
            select: {
              id: true,
              providerId: true,
              status: true,
              qrCode: true,
              qrCodeUrl: true
            }
          }
        }
      });

      if (!pedido) return NextResponse.json({ encontrado: false, pago: false, status: 'desconhecido' });

      const pago = pedido.status === 'PAID';

      return NextResponse.json({
        encontrado: true,
        pagamentoId: pedido.id,
        status: pedido.status,
        pago,
        externalId: pedido.code,
        charges: pedido.charges
      });
    }

    // 2) Alternativa: localizar por txid (Charge.providerId)
    if (txid) {
      const charge = await prisma.charge.findFirst({
        where: { providerId: txid },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          providerId: true,
          pedido: {
            select: { id: true, status: true, code: true }
          }
        }
      });

      if (!charge) return NextResponse.json({ encontrado: false, pago: false, status: 'desconhecido' });

      const pago = charge.status === 'PAID';

      return NextResponse.json({
        encontrado: true,
        pagamentoId: charge.pedido.id,
        status: charge.pedido.status,
        pago,
        externalId: charge.pedido.code,
        txid: charge.providerId
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

    const pedido = await prisma.pedido.findFirst({
      where: {
        amount: valorCent,
        description: descricao,
        createdAt: { gte: from },
        ...(clienteIp ? { ip: clienteIp } : {})
      },
      orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        code: true,
        charges: { select: { id: true, providerId: true, status: true } }
      }
    });

    if (!pedido) return NextResponse.json({ encontrado: false, pago: false, status: 'desconhecido' });

    return NextResponse.json({
      encontrado: true,
      pagamentoId: pedido.id,
      status: pedido.status,
      pago: pedido.status === 'PAID',
      externalId: pedido.code,
      charges: pedido.charges
    });
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

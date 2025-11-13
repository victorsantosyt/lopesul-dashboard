import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { pagarmeGET } from '@/lib/pagarme';

// Janela padrão de busca quando não há externalId/txid
const DEFAULT_LOOKBACK_MINUTES = 120;

function toCents(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function mapToPtStatus(s) {
  const t = String(s || '').toLowerCase();
  if (t === 'paid' || t === 'success' || t === 'succeeded') return 'pago';
  if (t === 'pending' || t === 'processing' || t === 'waiting_payment') return 'pendente';
  if (t === 'expired') return 'expirado';
  if (t === 'canceled' || t === 'cancelled') return 'cancelado';
  if (t === 'failed' || t === 'error') return 'falhou';
  return 'pendente';
}

async function checkPagarmeByOrderId(orderId) {
  try {
    const order = await pagarmeGET(`/orders/${orderId}`);
    const charge = Array.isArray(order?.charges) ? order.charges[0] : null;
    const trx = charge?.last_transaction || null;
    const st = mapToPtStatus(trx?.status || charge?.status || order?.status);
    
    // Sincroniza status com o banco de dados
    if (st === 'pago') {
      try {
        const pedido = await prisma.pedido.findUnique({ where: { code: orderId } });
        if (pedido && pedido.status !== 'PAID') {
          await prisma.pedido.update({
            where: { id: pedido.id },
            data: { status: 'PAID' }
          });
          console.log(`[VERIFICAR] Atualizou status para PAID: ${orderId}`);
          
          // Autoriza o cliente no MikroTik
          if (pedido.ip || pedido.deviceMac) {
            try {
              const libRes = await fetch(`${process.env.APP_URL || 'http://localhost:3000'}/api/liberar-acesso`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ externalId: orderId })
              });
              const libData = await libRes.json();
              console.log(`[VERIFICAR] Liberou acesso: ${libData.ok}`);
            } catch (libErr) {
              console.error(`[VERIFICAR] Erro ao liberar acesso:`, libErr.message);
            }
          }
        }
      } catch (dbErr) {
        console.error(`[VERIFICAR] Erro ao atualizar DB:`, dbErr.message);
      }
    }
    
    return {
      encontrado: true,
      status: st,
      pago: st === 'pago',
      externalId: order?.id || orderId,
      txid: trx?.id || charge?.id || null,
    };
  } catch (e) {
    return { encontrado: false, pago: false, status: 'desconhecido', detail: e?.message || String(e) };
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      externalId,   // preferencial (Pedido.code) ou ID de order da Pagar.me (ex.: or_...)
      txid,         // alternativa (Charge.providerId)
      valor,        // fallback em reais
      descricao,    // fallback
      clienteIp,    // opcional p/ desambiguar no fallback
      lookbackMin,  // opcional, padrão 120 min
    } = body || {};

    // 0) Se externalId parece um order da Pagar.me (ex.: or_abc), priorize consulta direta
    if (externalId && /^or_/i.test(String(externalId))) {
      const out = await checkPagarmeByOrderId(externalId);
      return NextResponse.json(out);
    }

    // 1) Caminho preferido: localizar por externalId (Pedido.code)
    if (externalId) {
      try {
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
          status: pago ? 'pago' : mapToPtStatus(pedido.status),
          pago,
          externalId: pedido.code,
          charges: pedido.charges
        });
      } catch (e) {
        // Falhou o acesso ao banco? Tente Pagar.me como fallback
        const out = await checkPagarmeByOrderId(externalId);
        return NextResponse.json(out);
      }
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
        status: pago ? 'pago' : mapToPtStatus(charge.pedido.status),
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
      status: pedido.status === 'PAID' ? 'pago' : mapToPtStatus(pedido.status),
      pago: pedido.status === 'PAID',
      externalId: pedido.code,
      charges: pedido.charges
    });
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

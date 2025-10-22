// src/app/api/liberar-acesso/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import prisma from '@/lib/prisma';
import mikrotik from '@/lib/mikrotik';
const { liberarCliente } = mikrotik;

/* Helper: JSON com CORS */
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/* Preflight CORS (para o pagamento.html chamar direto) */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { externalId, pagamentoId, txid, ip, mac, linkOrig } = body || {};

    if (!externalId && !pagamentoId && !txid) {
      return json({ ok: false, error: 'Informe externalId (code), pagamentoId ou txid.' }, 400);
    }

    // ============ Localiza o pedido ============
    let pedido = null;

    // 1) por externalId (code)
    if (externalId) {
      pedido = await prisma.pedido.findUnique({ where: { code: externalId } });
    }
    // 2) por pagamentoId
    if (!pedido && pagamentoId) {
      pedido = await prisma.pedido.findUnique({ where: { id: pagamentoId } });
    }
    // 3) via txid (tabela charge -> pega pedidoId)
    if (!pedido && txid) {
      const charge = await prisma.charge.findFirst({ where: { providerId: txid } });
      if (charge) {
        pedido = await prisma.pedido.findUnique({ where: { id: charge.pedidoId } });
      }
    }

    if (!pedido) {
      return json({ ok: false, error: 'Pagamento/Pedido não encontrado.' }, 404);
    }

    // ============ Marca como pago (idempotente) ============
    if (pedido.status !== 'PAID') {
      try {
        pedido = await prisma.pedido.update({
          where: { id: pedido.id },
          data: { status: 'PAID' },
        });
      } catch {
        // se o schema não permitir/usar outro enum, segue sem travar
      }
    }

    // ============ Liberação no MikroTik ============
    const ipFinal  = ip  || pedido.ip       || null;
    const macFinal = mac || pedido.deviceMac || null;

    let mk = { ok: true, note: 'sem ip/mac para liberar (somente status atualizado)' };
    if (ipFinal || macFinal) {
      try {
        mk = await liberarCliente({
          ip: ipFinal || undefined,
          mac: macFinal || undefined,
          comment: `pedido:${pedido.id}`,
        });
      } catch (e) {
        // Se der erro na liberação, devolve 502 mas com contexto do pedido atualizado
        return json({
          ok: false,
          error: e?.message || 'falha liberarCliente',
          pedidoId: pedido.id,
          code: pedido.code,
          status: pedido.status,
        }, 502);
      }
    }

    return json({
      ok: true,
      pedidoId: pedido.id,
      code: pedido.code,
      status: pedido.status,
      mikrotik: mk,
      redirect: linkOrig || null,
    });
  } catch (e) {
    console.error('POST /api/liberar-acesso error:', e);
    return json({ ok: false, error: 'Falha ao liberar acesso' }, 500);
  }
}

// src/app/api/liberar-acesso/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import prisma from '@/lib/prisma';
import { liberarAcessoPorPedido } from '@/lib/mikrotikService';

/* ===== helpers ===== */
function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}

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

const MAC_RE = /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i;
const IPV4_RE =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function normMac(s) {
  if (!s) return null;
  const up = String(s).trim().toUpperCase();
  const mac = up.replace(/-/g, ':');
  return MAC_RE.test(mac) ? mac : null;
}
function normIp(s) {
  if (!s) return null;
  const ip = String(s).trim();
  return IPV4_RE.test(ip) ? ip : null;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { externalId, pagamentoId, txid, ip, mac, linkOrig } = body || {};

    if (!externalId && !pagamentoId && !txid) {
      return json(
        { ok: false, error: 'Informe externalId (code), pagamentoId ou txid.' },
        400,
      );
    }

    // ============ localizar pedido ============
    let pedido = null;

    if (externalId) {
      // externalId == code (teu schema)
      pedido = await prisma.pedido.findUnique({ where: { code: externalId } });
    }
    if (!pedido && pagamentoId) {
      pedido = await prisma.pedido.findUnique({ where: { id: pagamentoId } });
    }
    if (!pedido && txid) {
      const charge = await prisma.charge.findFirst({
        where: { providerId: txid },
        select: { pedidoId: true },
      });
      if (charge?.pedidoId) {
        pedido = await prisma.pedido.findUnique({ where: { id: charge.pedidoId } });
      }
    }

    if (!pedido) {
      return json({ ok: false, error: 'Pagamento/Pedido não encontrado.' }, 404);
    }

    // ============ marca como PAID (idempotente) ============
    if (pedido.status !== 'PAID') {
      try {
        pedido = await prisma.pedido.update({
          where: { id: pedido.id },
          data: { status: 'PAID' },
        });
      } catch {
        // se enum/coluna diverge, não travar o fluxo
      }
    }

    // ============ decidir IP/MAC e validar ============
    const ipFinal = normIp(ip || pedido.ip || null);
    const macFinal = normMac(mac || pedido.deviceMac || null);

    if (!ipFinal && !macFinal) {
      return json(
        {
          ok: false,
          error: 'Sem IP/MAC válidos (nem no payload, nem no Pedido).',
          pedidoId: pedido.id,
          code: pedido.code,
        },
        400,
      );
    }

    console.log('[liberar-acesso] Liberando acesso via mikrotikService', {
      pedidoId: pedido.id,
      code: pedido.code,
      ip: ipFinal,
      mac: macFinal,
      busId: pedido.busId,
    });

    let result;
    try {
      result = await liberarAcessoPorPedido({
        pedido,
        ipOverride: ipFinal,
        macOverride: macFinal,
        origem: 'api/liberar-acesso',
        criarSessao: true,
      });
    } catch (e) {
      console.error('[liberar-acesso] Erro ao liberar acesso (multi-roteador):', e);
      return json(
        {
          ok: false,
          error: e?.message || 'falha liberarAcessoPorPedido',
          pedidoId: pedido.id,
          code: pedido.code,
          status: pedido.status,
        },
        502,
      );
    }

    return json(
      {
        ok: result.ok,
        pedidoId: pedido.id,
        code: pedido.code,
        status: pedido.status,
        roteadorId: result.roteadorId || null,
        sessaoId: result.sessaoId || null,
        mikrotik: result.mikrotik,
        redirect: linkOrig || null,
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  } catch (e) {
    console.error('POST /api/liberar-acesso error:', e);
    return json({ ok: false, error: 'Falha ao liberar acesso' }, 500);
  }
}

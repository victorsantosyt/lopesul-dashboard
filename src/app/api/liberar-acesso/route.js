// src/app/api/liberar-acesso/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import prisma from '@/lib/prisma';
import { liberarAcesso } from '@/lib/mikrotik';
import { requireDeviceRouter } from '@/lib/device-router';

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
  // aceita com : ou -; normaliza para :
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
    const sanitizeId = (value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed || /^\$\(.+\)$/.test(trimmed)) return null;
      return trimmed;
    };
    const bodyDeviceId = sanitizeId(body?.deviceId);
    const bodyMikId = sanitizeId(body?.mikId);

    if (!externalId && !pagamentoId && !txid) {
      return json(
        { ok: false, error: 'Informe externalId (code), pagamentoId ou txid.' },
        400
      );
    }

    // ============ localizar pedido ============
    let pedido = null;

    if (externalId) {
      // externalId == code (teu schema)
      pedido = await prisma.pedido.findUnique({
        where: { code: externalId },
        include: { device: true },
      });
    }
    if (!pedido && pagamentoId) {
      pedido = await prisma.pedido.findUnique({
        where: { id: pagamentoId },
        include: { device: true },
      });
    }
    if (!pedido && txid) {
      const charge = await prisma.charge.findFirst({
        where: { providerId: txid },
        select: { pedidoId: true },
      });
      if (charge?.pedidoId) {
        pedido = await prisma.pedido.findUnique({
          where: { id: charge.pedidoId },
          include: { device: true },
        });
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
    const ipFinal  = normIp(ip || pedido.ip || null);
    const macFinal = normMac(mac || pedido.deviceMac || null);

    const deviceLookup = {
      deviceId: bodyDeviceId || pedido.deviceId,
      mikId: bodyMikId || pedido.device?.mikId || pedido.deviceIdentifier,
    };

    let routerInfo;
    try {
      routerInfo = await requireDeviceRouter(deviceLookup);
    } catch (err) {
      return json(
        {
          ok: false,
          error: err?.code || 'device_not_found',
          detail: err?.message,
        },
        400
      );
    }

    // comentário curto e rastreável
    const comment = `pedido:${pedido.id}`.slice(0, 64);

    // ============ liberação no MikroTik ============
    let mk = { ok: true, note: 'sem ip/mac válidos; apenas status atualizado' };

    if (ipFinal || macFinal) {
      try {
        mk = await liberarAcesso({
          ip: ipFinal || undefined,
          mac: macFinal || undefined,
          comment,
          router: routerInfo.router,
        });
      } catch (e) {
        // se falhar a liberação, reporta 502 mas mantém pedido atualizado
        return json(
          {
            ok: false,
            error: e?.message || 'falha liberarCliente',
            pedidoId: pedido.id,
            code: pedido.code,
            status: pedido.status,
          },
          502
        );
      }
    }

    return json(
      {
        ok: true,
        pedidoId: pedido.id,
        code: pedido.code,
        status: pedido.status, // esperado: PAID
        mikrotik: mk,
        redirect: linkOrig || null,
      },
      200,
      { 'Cache-Control': 'no-store' }
    );
  } catch (e) {
    console.error('POST /api/liberar-acesso error:', e);
    return json({ ok: false, error: 'Falha ao liberar acesso' }, 500);
  }
}

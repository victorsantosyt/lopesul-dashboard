// src/app/api/sessoes/revogar/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/* ---------- utils ---------- */
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

function isIp(s) {
  return typeof s === 'string' && /^(\d{1,3}\.){3}\d{1,3}$/.test(s);
}
function isMac(s) {
  return typeof s === 'string' && /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(s);
}

/* ---------- CORS preflight ---------- */
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

/**
 * Revoga sessões ativas.
 * Body (JSON) – qualquer uma das combinações:
 *  - { id: "sessaoId" }
 *  - { ip: "1.2.3.4" }
 *  - { mac: "AA:BB:CC:DD:EE:FF" }
 *  - { ip: "...", mac: "..." }
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const id  = body?.id?.toString().trim() || null;
    const ip0 = body?.ip?.toString().trim() || null;
    const mac0 = body?.mac?.toString().trim() || null;

    const ip  = ip0 && isIp(ip0) ? ip0 : (ip0 ? null : null);
    const mac = mac0 ? mac0.toUpperCase() : null;

    if (!id && !ip && !mac) {
      return json({ error: "Informe 'id' OU 'ip'/'mac' no corpo da requisição." }, 400);
    }
    if (ip0 && !ip) {
      return json({ error: "IP inválido. Use formato IPv4, ex.: 10.0.0.23" }, 400);
    }
    if (mac0 && !isMac(mac0)) {
      return json({ error: "MAC inválido. Use AA:BB:CC:DD:EE:FF" }, 400);
    }

    // ---------- Descobrir sessões a revogar ----------
    let sessions = [];

    if (id) {
      // busca direta por id
      const s = await prisma.sessaoAtiva.findUnique({
        where: { id },
        select: { id: true, ipCliente: true, macCliente: true, ativo: true },
      });
      if (!s) return json({ error: 'Sessão não encontrada.' }, 404);
      if (!s.ativo) {
        // já está inativa → idempotente
        return json({ ok: true, revoked: 0, ids: [], note: 'já inativa' });
      }
      sessions = [s];
    } else {
      // busca por ip/mac, somente ativas
      const AND = [{ ativo: true }];
      if (ip)  AND.push({ ipCliente:  ip });
      if (mac) AND.push({ macCliente: mac });

      sessions = await prisma.sessaoAtiva.findMany({
        where: { AND },
        orderBy: { inicioEm: 'desc' },
        take: 100, // limite de segurança
        select: { id: true, ipCliente: true, macCliente: true, ativo: true },
      });
    }

    if (!sessions.length) {
      return json({ ok: true, revoked: 0, ids: [] });
    }

    // ---------- Atualiza banco (idempotente) ----------
    const ids = sessions.map(s => s.id);
    const now = new Date();

    await prisma.sessaoAtiva.updateMany({
      where: { id: { in: ids }, ativo: true },
      data: { ativo: false, expiraEm: now },
    });

    // ---------- (Opcional) Derrubar no Mikrotik ----------
    // Se quiser integrar, descomente e implemente em '@/lib/router'
    //
    // try {
    //   if (process.env.MIKROTIK_HOST) {
    //     const { disconnectByIpMac } = await import('@/lib/router');
    //     for (const s of sessions) {
    //       await disconnectByIpMac({ ip: s.ipCliente, mac: s.macCliente });
    //     }
    //   }
    // } catch (e) {
    //   console.warn('Falha ao revogar no roteador:', e?.message || e);
    // }

    return json({ ok: true, revoked: ids.length, ids });
  } catch (e) {
    console.error('POST /api/sessoes/revogar', e?.message || e);
    return json({ error: 'Erro interno' }, 500);
  }
}

// src/app/api/roteadores/[id]/status/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { tcpCheck, pingCheck } from '@/lib/netcheck';
import { relayFetch } from '@/lib/relay';

const TIMEOUT_MS = 2500;

export async function GET(_req, { params }) {
  try {
    const id = String(params?.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const roteador = await prisma.roteador.findUnique({ where: { id } });
    if (!roteador) {
      return NextResponse.json({ error: 'Roteador não encontrado' }, { status: 404 });
    }

    const host = roteador.ipLan;
    const port = roteador.portaApi || Number(process.env.MIKROTIK_PORT || 8728);
    const user = process.env.MIKROTIK_USER || roteador.usuario || '';
    const pass = process.env.MIKROTIK_PASS || '';

    let mikrotikOnlineTcp = false;
    let identity = null;

    // Check Mikrotik TCP na porta API configurada
    mikrotikOnlineTcp = await tcpCheck(host, port, TIMEOUT_MS).catch(() => false);

    // Ping como fallback adicional
    const pingOk = await pingCheck(host, TIMEOUT_MS).catch(() => false);

    const mikrotikOnline = mikrotikOnlineTcp || pingOk;

    // Se considerarmos online e tivermos credenciais, tenta obter identity via relay
    if (mikrotikOnline && host && user && pass) {
      try {
        const r = await relayFetch('/relay/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host,
            user,
            pass,
            command: '/system/identity/print',
          }),
        });
        const j = await r.json().catch(() => ({}));
        const rows = Array.isArray(j?.data) ? j.data : [];
        if (rows[0]?.name) {
          identity = rows[0].name;
        }
      } catch (e) {
        console.warn('roteador identity fetch failed', id, e?.message || e);
      }
    }

    // Persist status snapshot
    const updated = await prisma.roteador.update({
      where: { id },
      data: {
        statusMikrotik: mikrotikOnline ? 'ONLINE' : 'OFFLINE',
      },
      select: {
        id: true,
        nome: true,
        ipLan: true,
        portaApi: true,
        statusMikrotik: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        mikrotikOnline,
        pingOk,
        identity,
        roteador: updated,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('GET /api/roteadores/[id]/status =>', err);
    return NextResponse.json(
      { ok: false, error: 'Erro ao checar status do roteador' },
      { status: 500 }
    );
  }
}

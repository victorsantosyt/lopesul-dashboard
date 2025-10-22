// src/app/api/dispositivos/status/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAnyOnline, checkStarlink } from '@/lib/netcheck';
import { relayFetch, getRelayBase } from '@/lib/relay';

const MAX_HOSTS = 1000;

function pickIp(row) {
  return row?.ip ?? row?.enderecoIp ?? row?.ipAddress ?? row?.host ?? null;
}

function uniq(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

async function safe(fn, fallback) {
  try { return await fn(); } catch { return fallback; }
}

export async function GET() {
  try {
    // 1) Coleta IPs dos dispositivos (resiliente se a tabela não existir)
    const dispositivos = await safe(
      () => prisma.dispositivo.findMany({ take: MAX_HOSTS }),
      []
    );

    let ipsDb = uniq(dispositivos.map(pickIp)).slice(0, MAX_HOSTS);

    // 2) Acrescenta alvos “sistêmicos”
    const mkHost = process.env.MIKROTIK_HOST || null;
    const slHost = process.env.STARLINK_HOST || null;
    if (mkHost) ipsDb.push(mkHost);
    if (slHost) ipsDb.push(slHost);
    ipsDb = uniq(ipsDb).slice(0, MAX_HOSTS);

    // 3) Checks em paralelo
    const [mk, sl, relay] = await Promise.all([
      safe(() => checkAnyOnline(ipsDb), { online: false }),
      safe(() => checkStarlink(ipsDb), { online: false }),
      safe(async () => {
        const base = getRelayBase(); // usa RELAY_URL ou RELAY_BASE
        if (!base) return { online: false, error: 'RELAY_BASE ausente' };
        const r = await relayFetch('/health', { method: 'GET' });
        const j = await r.json().catch(() => ({}));
        return { online: Boolean(r.ok && (j?.ok ?? true)), raw: j };
      }, { online: false }),
    ]);

    // 4) Monta resposta
    const resp = {
      mikrotik: {
        online: Boolean(mk.online),
        hosts: ipsDb,
        lastHost: mk.lastHost ?? null,
        port: Number(process.env.MIKROTIK_PORT || 8728),
        via: process.env.MIKROTIK_VIA_VPS === '1' ? 'vps:ssh' : 'direct',
      },
      starlink: {
        online: Boolean(sl.online),
        hosts: ipsDb,
        lastHost: sl.lastHost ?? null,
        via: process.env.STARLINK_VIA_VPS === '1' ? 'vps:ssh' : 'direct',
      },
      relay: {
        online: Boolean(relay.online),
        base: getRelayBase() || null,
      },
      meta: {
        totalHosts: ipsDb.length,
        ts: Date.now(),
      },
    };

    return NextResponse.json(resp, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('GET /api/dispositivos/status', e?.message || e);
    return NextResponse.json(
      {
        mikrotik: { online: false },
        starlink: { online: false },
        relay: { online: false },
        meta: { totalHosts: 0, ts: Date.now() },
      },
      { status: 200 }
    );
  }
}

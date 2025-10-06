// src/app/api/frotas/[id]/status/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getStarlinkStatus } from '@/lib/mikrotik';

export async function GET(req, { params }) {
  try {
    const id = String(params?.id || '');
    if (!id) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const status = await getStarlinkStatus({
      host: process.env.MIKROTIK_HOST,
      user: process.env.MIKROTIK_USER,
      pass: process.env.MIKROTIK_PASS,
    });

    if (!status) {
      return NextResponse.json({ ok: false, error: 'Sem resposta do Mikrotik' }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      id,
      identity: status.identity ?? null,
      iface: status.starlink.iface,
      ip: status.starlink.ip ?? null,
      linkUp: status.starlink.link,
      pingOk: status.internet.ok,
      rttMs: status.internet.rtt_ms,
      perdaPct: status.internet.loss_pct,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GET /api/frotas/[id]/status', error);
    return NextResponse.json(
      { ok: false, error: 'Erro ao consultar status técnico' },
      { status: 500 }
    );
  }
}

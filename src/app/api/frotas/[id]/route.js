// runtime & caching
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { relayFetch } from '@/lib/relay';

export async function GET(_req, { params }) {
  const id = String(params?.id || '');
  if (!id) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const host = process.env.MIKROTIK_HOST || '';
  const user = process.env.MIKROTIK_USER || '';
  const pass = process.env.MIKROTIK_PASS || '';
  if (!host || !user || !pass) {
    return NextResponse.json({ error: 'mikrotik_env_missing' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    // Ping a partir do Mikrotik (via Relay)
    const r = await relayFetch('/relay/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, user, pass, command: '/ping address=1.1.1.1 count=3' }),
    }).catch(() => null);

    if (!r) {
      return NextResponse.json({ error: 'relay_unreachable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }

    const j = await r.json().catch(() => ({}));
    const rows = Array.isArray(j?.data) ? j.data : [];
    const pingOk = Boolean(j?.ok && rows.length > 0);

    // Se quiser evoluir depois: parsear RTT e perda das linhas do RouterOS
    return NextResponse.json(
      { pingOk, rttMs: null, perdaPct: null, checkedAt: new Date().toISOString() },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json({ error: 'internal_error', detail: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

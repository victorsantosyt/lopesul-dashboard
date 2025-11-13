// src/app/api/mikrotik/status/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { relayFetch } from '@/lib/relay';
import { tcpCheck, pingCheck } from '@/lib/netcheck';

const TIMEOUT_MS = 2500;

export async function GET() {
  const host = process.env.MIKROTIK_HOST || '';
  const user = process.env.MIKROTIK_USER || '';
  const pass = process.env.MIKROTIK_PASS || '';
  const starlinkHost = process.env.STARLINK_HOST || host;

  // Se não houver credenciais, retorna offline
  if (!host || !user || !pass) {
    return NextResponse.json(
      {
        ok: false,
        mikrotik: 'offline',
        starlink: 'offline',
        flags: { hasLink: false, pingSuccess: false },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    // Verifica conectividade direta com MikroTik e Starlink
    const port = parseInt(process.env.MIKROTIK_PORT || process.env.PORTA_MIKROTIK || '8728', 10);
    
    const [mkResult, starlinkResult, identityResult] = await Promise.allSettled([
      // MikroTik: TCP check na porta API
      tcpCheck(host, port, TIMEOUT_MS),

      // Starlink: TCP ou ping check
      (async () => {
        if (await tcpCheck(starlinkHost, 80, TIMEOUT_MS)) return { online: true, via: 'tcp:80' };
        if (await pingCheck(starlinkHost, TIMEOUT_MS)) return { online: true, via: 'ping' };
        return { online: false };
      })(),

      // Tenta pegar identity via relay (opcional)
      relayFetch('/relay/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          user,
          pass,
          command: '/system/identity/print',
        }),
      })
        .then(r => r.json())
        .catch(() => null),
    ]);

    // Parse MikroTik response
    const mikrotikOnline = mkResult.status === 'fulfilled' && mkResult.value === true;
    
    // Parse identity se conseguiu
    let identity = null;
    if (identityResult.status === 'fulfilled' && identityResult.value?.ok) {
      const data = identityResult.value.data;
      if (Array.isArray(data) && data[0]?.name) {
        identity = data[0].name;
      }
    }

    // Parse Starlink response
    const starlinkOnline = starlinkResult.status === 'fulfilled' && starlinkResult.value?.online;

    return NextResponse.json(
      {
        ok: mikrotikOnline,
        mikrotik: mikrotikOnline ? 'online' : 'offline',
        starlink: starlinkOnline ? 'online' : 'offline',
        identity,
        flags: {
          hasLink: starlinkOnline,
          pingSuccess: starlinkOnline,
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('GET /api/mikrotik/status:', e?.message || e);
    return NextResponse.json(
      {
        ok: false,
        mikrotik: 'offline',
        starlink: 'offline',
        error: String(e?.message || e),
        flags: { hasLink: false, pingSuccess: false },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

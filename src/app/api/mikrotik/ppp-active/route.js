// src/app/api/mikrotik/ppp-active/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { listPppActive as listPppActiveLib } from '@/lib/mikrotik';
import { RouterOSClient } from 'routeros-client';

// helpers ENV (alinha com /ping e /status)
const yes = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').toLowerCase());
function getCfg() {
  const host =
    process.env.MIKROTIK_HOST ||
    process.env.MIKOTIK_HOST || // fallback p/ typo
    null;

  const user = process.env.MIKROTIK_USER || process.env.MIKROTIK_USERNAME || null;
  const pass = process.env.MIKROTIK_PASS || process.env.MIKROTIK_PASSWORD || null;

  const secure = yes(process.env.MIKROTIK_SSL) || yes(process.env.MIKROTIK_SECURE);
  const port = Number(
    process.env.MIKROTIK_PORT ||
      process.env.PORTA_MIKROTIK ||
      (secure ? 8729 : 8728)
  );

  const timeout = Number(process.env.MIKROTIK_TIMEOUT_MS || 8000);

  return { host, user, pass, secure, port, timeout };
}

function mapRow(x) {
  return {
    id: x['.id'] || x.id || null,
    name: x.name || null,
    address: x.address || null,          // IP remoto
    callerId: x['caller-id'] || null,    // MAC/ident
    service: x.service || null,
    uptime: x.uptime || null,
    encoding: x.encoding || null,
  };
}

async function listPppActiveFallback(limit = 200) {
  const cfg = getCfg();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    throw new Error('Config Mikrotik ausente (host/user/pass)');
  }
  const api = new RouterOSClient({
    host: cfg.host,
    user: cfg.user,
    pass: cfg.pass,
    port: cfg.port,
    secure: cfg.secure,
    timeout: cfg.timeout,
  });

  await api.connect();
  try {
    const res = await api.menu('/ppp/active').print();
    const arr = Array.isArray(res) ? res : [];
    return arr.slice(0, limit).map(mapRow);
  } finally {
    try { await api.close(); } catch {}
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);

  try {
    // tenta via lib, senão usa fallback direto no RouterOS
    let rows = null;
    if (typeof listPppActiveLib === 'function') {
      try { rows = await listPppActiveLib({ limit }); } catch {}
    }
    if (!rows) rows = await listPppActiveFallback(limit);

    return NextResponse.json({ ok: true, count: rows.length, rows }, { status: 200 });
  } catch (e) {
    console.error('GET /api/mikrotik/ppp-active error:', e?.message, e?.stack || e);
    // Mantém 200 + ok:false para não quebrar o dashboard
    return NextResponse.json(
      { ok: false, rows: [], error: 'Falha ao consultar PPP Active' },
      { status: 200 }
    );
  }
}

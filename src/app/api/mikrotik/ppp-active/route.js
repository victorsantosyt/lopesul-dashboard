// src/app/api/mikrotik/ppp-active/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
// ajuste: importa default e desestrutura
import mikrotik from '@/lib/mikrotik';
const { listPppActive: listPppActiveLib } = mikrotik;
import { RouterOSClient } from 'routeros-client';

// helpers ENV (alinha com /status)
const yes = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').toLowerCase());
function getCfg() {
  const host =
    process.env.MIKROTIK_HOST ||
    process.env.MIKOTIK_HOST || // fallback p/ typo
    null;

  const user =
    process.env.MIKROTIK_USER ||
    process.env.MIKROTIK_USERNAME ||
    null;

  const password =
    process.env.MIKROTIK_PASS ||
    process.env.MIKROTIK_PASSWORD ||
    null;

  const ssl = yes(process.env.MIKROTIK_SSL) || yes(process.env.MIKROTIK_SECURE);
  const port = Number(
    process.env.MIKROTIK_PORT ||
      process.env.PORTA_MIKROTIK ||
      (ssl ? 8729 : 8728)
  );

  const timeout = Number(process.env.MIKROTIK_TIMEOUT_MS || 8000);

  return { host, user, password, ssl, port, timeout };
}

function mapRow(x) {
  return {
    id: x['.id'] || x.id || null,
    name: x.name || null,
    address: x.address || null,          // IP remoto
    callerId: x['caller-id'] || x.callerId || null,
    service: x.service || null,
    uptime: x.uptime || null,
    encoding: x.encoding || null,
  };
}

async function listPppActiveFallback(limit = 200) {
  const cfg = getCfg();
  if (!cfg.host || !cfg.user || !cfg.password) {
    throw new Error('Config Mikrotik ausente (host/user/password)');
  }

  const api = new RouterOSClient({
    host: cfg.host,
    user: cfg.user,
    password: cfg.password, // <- chave correta
    port: cfg.port,
    ssl: cfg.ssl,           // <- chave correta
    timeout: cfg.timeout,
    // rejectUnauthorized: false, // habilite se usar certificado self-signed
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
  const limitRaw = parseInt(url.searchParams.get('limit') || '200', 10);
  const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 200, 500));

  const cfg = getCfg();
  if (!cfg.host || !cfg.user || !cfg.password) {
    return NextResponse.json(
      { ok: false, rows: [], count: 0, error: 'Config Mikrotik ausente (host/user/password)' },
      { status: 200 }
    );
  }

  try {
    let rows = null;
    if (typeof listPppActiveLib === 'function') {
      try { rows = await listPppActiveLib({ limit }); } catch {}
    }
    if (!rows) rows = await listPppActiveFallback(limit);

    return NextResponse.json({ ok: true, count: rows.length, rows }, { status: 200 });
  } catch (e) {
    console.error('GET /api/mikrotik/ppp-active error:', e?.message, e?.stack || e);
    return NextResponse.json(
      { ok: false, rows: [], error: 'Falha ao consultar PPP Active' },
      { status: 200 }
    );
  }
}

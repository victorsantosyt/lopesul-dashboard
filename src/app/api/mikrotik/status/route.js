// src/app/api/mikrotik/status/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { RouterOSClient } from 'routeros-client';

// helpers de env (aceita sinônimos)
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

  const defaultList =
    process.env.MIKROTIK_PAID_LIST ||
    process.env.LISTA_PAGA_MIKROTIK ||
    'paid_clients';

  return { host, user, password, ssl, port, timeout, defaultList };
}

export async function GET(req) {
  const cfg = getCfg();
  if (!cfg.host || !cfg.user || !cfg.password) {
    return NextResponse.json(
      { ok: false, error: 'Configuração Mikrotik ausente (host/user/password)' },
      { status: 400 }
    );
  }

  let api;
  try {
    const { searchParams } = new URL(req.url);
    const list = searchParams.get('list') || cfg.defaultList;
    const limitRaw = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 100, 200));

    api = new RouterOSClient({
      host: cfg.host,
      user: cfg.user,
      password: cfg.password, // <- chave correta
      port: cfg.port,
      ssl: cfg.ssl,           // <- chave correta
      timeout: cfg.timeout,
      // rejectUnauthorized: false, // se usar cert self-signed
    });

    await api.connect();

    // identity (nome do roteador)
    let identity = null;
    try {
      const idRes = await api.menu('/system/identity').print();
      identity = Array.isArray(idRes) && idRes[0]?.name ? idRes[0].name : null;
    } catch {}

    // address-list
    const raw = await api.menu('/ip/firewall/address-list').print({
      where: [['list', '=', list]],
    });

    const items = (Array.isArray(raw) ? raw : [])
      .slice(0, limit)
      .map((x) => ({
        id: x['.id'] || x.id || null,
        address: x.address || null,
        list: x.list || null,
        comment: x.comment || null,
        disabled: x.disabled === 'true' || x.disabled === true,
        ...(x['creation-time'] ? { creationTime: x['creation-time'] } : {}),
      }));

    return NextResponse.json({
      ok: true,
      identity,
      list,
      count: items.length,
      items,
    });
  } catch (e) {
    console.error('GET /api/mikrotik/status error:', e?.message, e?.stack || e);
    return NextResponse.json(
      { ok: false, error: 'Falha ao consultar status do Mikrotik' },
      { status: 502 }
    );
  } finally {
    try { await api?.close(); } catch {}
  }
}

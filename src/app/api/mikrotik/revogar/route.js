// src/app/api/mikrotik/revogar/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { revogarAcesso } from '@/lib/mikrotik';

const ipv4 =
  /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
const ipv6 =
  /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(([0-9a-f]{1,4}:){1,7}:)|(([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4})|(([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2})|(([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3})|(([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4})|(([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5})|([0-9a-f]{1,4}:)((:[0-9a-f]{1,4}){1,6})|:((:[0-9a-f]{1,4}){1,7}|:))(%.+)?$/i;

function isValidIp(s) {
  return ipv4.test(s) || ipv6.test(s);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ip = (body?.ip || '').trim();
    const list = body?.list || undefined;

    if (!ip || !isValidIp(ip)) {
      return NextResponse.json({ ok: false, error: 'IP inválido' }, { status: 400 });
    }

    const r = await revogarAcesso({ ip, list });
    // r: { ok, removed, list, ip, reason? }
    return NextResponse.json({ ok: r.ok, ...r }, { status: 200 });
  } catch (e) {
    const msg = String(e?.message || e);
    console.error('POST /api/mikrotik/revogar error:', msg, e?.stack || e);
    const status = /timeout|ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|TLS|CERT/i.test(msg) ? 502 : 500;
    return NextResponse.json({ ok: false, error: 'Falha ao revogar acesso' }, { status });
  }
}

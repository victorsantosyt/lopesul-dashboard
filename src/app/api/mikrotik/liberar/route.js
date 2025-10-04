// src/app/api/mikrotik/liberar/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { liberarAcesso } from '@/lib/mikrotik';

const ipv4 =
  /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
const ipv6 =
  /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(([0-9a-f]{1,4}:){1,7}:)|(([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4})|(([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2})|(([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3})|(([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4})|(([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5})|([0-9a-f]{1,4}:)((:[0-9a-f]{1,4}){1,6})|:((:[0-9a-f]{1,4}){1,7}|:))(%.+)?$/i;

function isValidIp(s) {
  return ipv4.test(s) || ipv6.test(s);
}

// list: somente [a-zA-Z0-9_-], 1..32
function sanitizeListName(s) {
  if (typeof s !== 'string') return undefined;
  const ok = s.trim();
  return /^[A-Za-z0-9_-]{1,32}$/.test(ok) ? ok : undefined;
}

// busId: mantém caracteres seguros e limita tamanho (p/ comment)
function sanitizeBusId(s) {
  if (typeof s !== 'string') return undefined;
  const trimmed = s.trim().slice(0, 64);
  const safe = trimmed.replace(/[^A-Za-z0-9 _\-.:]/g, '');
  return safe.length ? safe : undefined;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ip = (body?.ip || '').trim();
    const busId = sanitizeBusId(body?.busId);
    const list = sanitizeListName(body?.list); // se inválido, fica undefined (usa default da lib)

    if (!ip || !isValidIp(ip)) {
      return NextResponse.json({ ok: false, error: 'IP inválido' }, { status: 400 });
    }

    const r = await liberarAcesso({ ip, busId, list });
    // r: { ok: true, list, ip, id, created }
    return NextResponse.json({ ok: true, ...r }, { status: 200 });
  } catch (e) {
    const msg = String(e?.message || e);
    console.error('POST /api/mikrotik/liberar error:', msg, e?.stack || e);
    const status = /timeout|ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|TLS|CERT/i.test(msg) ? 502 : 500;
    return NextResponse.json({ ok: false, error: 'Falha ao liberar acesso' }, { status });
  }
}

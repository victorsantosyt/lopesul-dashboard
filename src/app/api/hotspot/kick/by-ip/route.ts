// app/api/hotspot/kick/by-ip/route.ts
import { relayFetch } from '@/lib/relay';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: cors(),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ip = String(body?.ip || '').trim();

  // valida IPv4 básico
  if (!ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return json({ ok: false, error: 'invalid ip' }, 400);
  }

  try {
    const r = await relayFetch('/hotspot/kick/by-ip', {
      method: 'POST',
      body: JSON.stringify({ ip }),
    });
    const j = await r.json().catch(() => ({}));
    return json(j, r.status);
  } catch {
    return json({ ok: false, error: 'relay_unreachable' }, 502);
  }
}

/* helpers */
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}
function json(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: cors() });
}

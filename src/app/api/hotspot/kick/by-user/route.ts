// app/api/hotspot/kick/by-user/route.ts
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
  const user = String(body?.user || '').trim();

  if (!user) {
    return json({ ok: false, error: 'missing user' }, 400);
  }

  try {
    const r = await relayFetch('/hotspot/kick/by-user', {
      method: 'POST',
      body: JSON.stringify({ user }),
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

// app/api/command/exec/route.ts
import { relayFetch } from '@/lib/relay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// CORS p/ captive no browser (se precisar bater direto)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const command = String(body?.command || '').trim();

  if (!command) {
    return corsJson({ ok: false, error: 'missing command' }, 400);
  }

  const host = process.env.MIKROTIK_HOST || '';
  const user = process.env.MIKROTIK_USER || '';
  const pass = process.env.MIKROTIK_PASS || '';

  if (!host || !user || !pass) {
    return corsJson({ ok: false, error: 'mikrotik env missing' }, 500);
  }

  try {
    const r = await relayFetch('/relay/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // ✅ header explícito
      body: JSON.stringify({ host, user, pass, command }),
    });

    const j = await r.json().catch(() => ({}));
    return corsJson(j, r.status);
  } catch {
    return corsJson({ ok: false, error: 'relay_unreachable' }, 502);
  }
}

function corsJson(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

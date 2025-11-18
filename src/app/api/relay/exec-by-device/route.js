import { relayFetch } from '@/lib/relay';
import { requireDeviceRouter } from '@/lib/device-router';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const command = typeof body?.command === 'string' ? body.command.trim() : '';
  const sentences = Array.isArray(body?.sentences) ? body.sentences : null;

  if (!command && (!sentences || sentences.length === 0)) {
    return corsJson({ ok: false, error: 'missing command' }, 400);
  }

  const asString = (value) => {
    if (typeof value === 'string') return value;
    if (value == null) return null;
    return String(value);
  };

  let routerInfo;
  try {
    routerInfo = await requireDeviceRouter({
      deviceId: asString(body?.deviceId),
      mikId: asString(body?.mikId),
    });
  } catch (err) {
    return corsJson(
      { ok: false, error: err?.code || 'device_not_found', detail: err?.message },
      err?.code === 'device_not_found' ? 404 : 400,
    );
  }

  const payload = {
    host: routerInfo.router.host,
    user: routerInfo.router.user,
    pass: routerInfo.router.pass,
    port: routerInfo.router.port,
  };

  if (sentences && sentences.length) {
    payload.sentences = sentences;
  } else {
    payload.command = command;
  }

  try {
    const r = await relayFetch('/relay/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    return corsJson(j, r.status);
  } catch (err) {
    return corsJson(
      { ok: false, error: 'relay_unreachable', detail: err?.message || String(err) },
      502,
    );
  }
}

function corsJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}


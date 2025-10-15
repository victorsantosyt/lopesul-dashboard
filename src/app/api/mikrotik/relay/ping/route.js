// app/api/mikrotik/relay/ping/route.js
export const dynamic = 'force-dynamic';

const TIMEOUT = 5000;

function withCors(json, status = 200) {
  return new Response(JSON.stringify(json), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function toHealth(url) {
  // aceita base (http://ip:3001) ou já com /relay/exec
  const base = url.replace(/\/relay\/exec\/?$/i, '').replace(/\/$/, '');
  return `${base}/health`;
}

function toExec(url) {
  // se já é /relay/exec mantém; se for base, anexa
  if (/\/relay\/exec\/?$/i.test(url)) return url;
  return `${url.replace(/\/$/, '')}/relay/exec`;
}

// CORS preflight (se o captive chamar do browser)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET() {
  const RELAY_URL = process.env.RELAY_URL;
  if (!RELAY_URL) {
    return withCors({ success: false, message: 'Backend ativo, mas RELAY_URL ausente.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const healthUrl = toHealth(RELAY_URL);
    const response = await fetch(healthUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      return withCors({ success: true, message: 'Relay online e respondendo.' });
    }
    return withCors({ success: false, message: `Relay respondeu ${response.status}, backend OK.` });
  } catch (err) {
    clearTimeout(timeout);
    return withCors({ success: false, message: 'Relay offline, backend ativo.', detail: err?.message });
  }
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { command } = body || {};

  const RELAY_URL = process.env.RELAY_URL;
  const MIKROTIK_HOST = process.env.MIKROTIK_HOST;
  const MIKROTIK_USER = process.env.MIKROTIK_USER;
  const MIKROTIK_PASS = process.env.MIKROTIK_PASS;

  if (!RELAY_URL || !MIKROTIK_HOST || !MIKROTIK_USER || !MIKROTIK_PASS) {
    return withCors({ success: false, error: 'Variáveis Mikrotik ausentes.' }, 500);
  }
  if (!command) {
    return withCors({ success: false, error: 'Nenhum comando Mikrotik fornecido.' }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const execUrl = toExec(RELAY_URL);
    const response = await fetch(execUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        host: MIKROTIK_HOST,
        user: MIKROTIK_USER,
        pass: MIKROTIK_PASS,
        command,
      }),
    });

    clearTimeout(timeout);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.ok === false) {
      return withCors({
        success: false,
        error: data?.error || `Falha ao executar no relay (HTTP ${response.status}).`,
      }, 502);
    }

    return withCors({ success: true, message: 'Comando executado via relay.', data });
  } catch (err) {
    clearTimeout(timeout);
    return withCors({
      success: false,
      message: 'Relay offline, backend OK.',
      detail: err?.name === 'AbortError' ? 'Timeout' : err?.message,
    });
  }
}

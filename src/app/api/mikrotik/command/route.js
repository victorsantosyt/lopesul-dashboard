// app/api/mikrotik/command/route.js  (se ficar em .../command/ping/route.js também funciona)
// Backend (Next.js) -> encaminha para o Relay

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 5000;

// CORS p/ browsers/captive
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

// aceita base (http://ip:3001) ou já com /relay/exec
function toExec(url) {
  if (!url) return '';
  if (/\/relay\/exec\/?$/i.test(url)) return url;
  return `${url.replace(/\/$/, '')}/relay/exec`;
}

export async function POST(req) {
  // 1) body
  const body = await req.json().catch(() => ({}));
  const command = String(body?.command || '').trim();

  if (!command) {
    return json({ success: false, error: 'Comando não fornecido.' }, 400);
  }

  // 2) envs
  const RELAY_BASE = process.env.RELAY_URL || ''; // pode ser base ou endpoint final
  const MIKROTIK_HOST = process.env.MIKROTIK_HOST || '';
  const MIKROTIK_USER = process.env.MIKROTIK_USER || '';
  const MIKROTIK_PASS = process.env.MIKROTIK_PASS || '';

  // 3) validações mínimas
  if (!RELAY_BASE || !MIKROTIK_HOST || !MIKROTIK_USER || !MIKROTIK_PASS) {
    return json({
      success: false,
      message: 'Variáveis Mikrotik ausentes, mas backend ativo.',
    }, 200);
  }

  // 4) monta URL do exec com tolerância a formatos
  const RELAY_EXEC = toExec(RELAY_BASE);

  // 5) timeout controller
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(RELAY_EXEC, {
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

    clearTimeout(t);

    // tenta json, sem quebrar se vier vazio
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.ok === false) {
      console.error('❌ Relay respondeu com erro:', data);
      return json({
        success: false,
        error: data?.error || `Falha ao executar comando via relay (HTTP ${res.status}).`,
      }, 502);
    }

    // sucesso transparente
    return json({ success: true, data }, 200);

  } catch (err) {
    clearTimeout(t);
    const msg = (err && err.name === 'AbortError')
      ? 'Timeout ao contatar relay.'
      : (err?.message || 'Relay Mikrotik inacessível.');
    console.warn('⚠️ Relay Mikrotik inacessível:', msg);
    return json({
      success: false,
      message: 'Relay Mikrotik offline, backend continua operacional.',
      detail: msg,
    }, 200);
  }
}

/* util: Response.json com CORS */
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

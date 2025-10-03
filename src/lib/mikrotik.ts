export function getMikrotikEnv() {
  const yes = (v?: string) => ['1','true','yes','on'].includes((v||'').toLowerCase());
  const host = process.env.MIKROTIK_HOST || process.env.MIKOTIK_HOST; // fallback p/ typo
  const ssl  = yes(process.env.MIKROTIK_SSL);
  const port = parseInt(process.env.PORTA_MIKROTIK || (ssl ? '8729' : '8728'), 10);
  const timeout = parseInt(process.env.MIKROTIK_TIMEOUT_MS || '8000', 10);
  return {
    host,
    user: process.env.MIKROTIK_USER,
    pass: process.env.MIKROTIK_PASS,
    port,
    secure: ssl,
    timeout,
  };
}

// src/lib/netcheck.js
import 'server-only';
import { Socket } from 'node:net';
import ping from 'ping';
import { NodeSSH } from 'node-ssh';

const USE_PING = process.env.NETCHECK_PING !== '0'; // defina NETCHECK_PING=0 p/ desligar ICMP

function getSshCfg() {
  const host = process.env.VPS_SSH_HOST;
  const username = process.env.VPS_SSH_USER;
  if (!host || !username) return null;
  const port = Number(process.env.VPS_SSH_PORT || 22);
  const privateKey = process.env.VPS_SSH_KEY?.replace(/\\n/g, '\n'); // suporta key via env
  const password = process.env.VPS_SSH_PASS;
  const cfg = { host, username, port };
  if (privateKey) cfg.privateKey = privateKey;
  else if (password) cfg.password = password;
  return cfg;
}

async function withSsh(run) {
  const cfg = getSshCfg();
  if (!cfg) return null;
  const ssh = new NodeSSH();
  await ssh.connect(cfg);
  try {
    return await run(ssh);
  } finally {
    try { ssh.dispose(); } catch {}
  }
}

/* ---------- CHECAGENS DIRETAS (do servidor atual) ---------- */
export function tcpCheck(host, port = Number(process.env.MIKROTIK_PORT || 8728), timeout = 1200) {
  return new Promise((resolve) => {
    if (!host) return resolve(false);
    const socket = new Socket();
    let done = false;
    const finish = (ok) => { if (!done) { done = true; try { socket.destroy(); } catch {} resolve(!!ok); } };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

export async function pingCheck(host, timeoutMs = 1200) {
  if (!USE_PING || !host) return false;
  try {
    const res = await ping.promise.probe(host, { timeout: Math.ceil(timeoutMs / 1000), extra: ['-c', '1'] });
    return !!res.alive;
  } catch {
    return false;
  }
}

/* ---------- CHECAGENS REMOTAS (via VPS por SSH) ---------- */
export async function remoteTcpCheck(host, port = Number(process.env.MIKROTIK_PORT || 8728), timeoutMs = 1200) {
  const out = await withSsh(async (ssh) => {
    const cmd = `bash -lc 'command -v nc >/dev/null && nc -z -w1 ${host} ${port} >/dev/null 2>&1 && echo OK || (timeout 1 bash -lc "</dev/tcp/${host}/${port}" >/dev/null 2>&1 && echo OK || echo FAIL)'`;
    const r = await ssh.execCommand(cmd, { execOptions: { timeout: timeoutMs } });
    return r.stdout.includes('OK');
  });
  return !!out;
}

export async function remotePingCheck(host, timeoutMs = 1200) {
  if (!USE_PING) return false;
  const out = await withSsh(async (ssh) => {
    const sec = Math.max(1, Math.ceil(timeoutMs / 1000));
    const cmd = `bash -lc 'ping -c1 -W ${sec} ${host} >/dev/null 2>&1 && echo OK || echo FAIL'`;
    const r = await ssh.execCommand(cmd, { execOptions: { timeout: timeoutMs } });
    return r.stdout.includes('OK');
  });
  return !!out;
}

/* ---------- ORQUESTRADORES ---------- */
export async function checkMikrotikStatus(host, opts = {}) {
  const viaVps = process.env.MIKROTIK_VIA_VPS === '1';
  const timeout = Number(opts.timeout ?? 1200);
  if (viaVps) {
    const [t, p] = await Promise.all([
      remoteTcpCheck(host, Number(process.env.MIKROTIK_PORT || 8728), timeout),
      remotePingCheck(host, timeout),
    ]);
    return (t || p) ? 'online' : 'offline';
  } else {
    const [t, p] = await Promise.all([
      tcpCheck(host, Number(process.env.MIKROTIK_PORT || 8728), timeout),
      pingCheck(host, timeout),
    ]);
    return (t || p) ? 'online' : 'offline';
  }
}

export async function checkAnyOnline(hosts) {
  const arr = Array.from(new Set((hosts || []).filter(Boolean)));
  for (const h of arr) {
    if ((await checkMikrotikStatus(h)) === 'online') return { online: true, lastHost: h };
  }
  return { online: false, lastHost: arr[0] || null };
}

/* Starlink helper (direto ou via VPS) */
export async function checkStarlink(hosts) {
  const viaVps = process.env.STARLINK_VIA_VPS === '1';
  const arr = Array.from(new Set((hosts || []).filter(Boolean)));
  const tryOne = async (h) => {
    if (viaVps) {
      if (await remoteTcpCheck(h, 80, 1200)) return true;
      if (await remotePingCheck(h, 1200))   return true;
    } else {
      if (await tcpCheck(h, 80, 1200)) return true;
      if (await pingCheck(h, 1200))   return true;
    }
    return false;
  };
  for (const h of arr) if (await tryOne(h)) return { online: true, lastHost: h };
  return { online: false, lastHost: arr[0] || null };
}

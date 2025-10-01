// src/lib/mikrotik.js
import { NodeSSH } from "node-ssh";

const ipRegex = /(\d{1,3}\.){3}\d{1,3}\/\d{1,2}/;
const ipv4Only = /(\d{1,3}\.){3}\d{1,3}/;
const rttRegex = /avg(?:\s*=|:)\s*([0-9.,]+)\s*ms|time=([0-9.,]+)\s*ms/i;
const receivedRegex = /received(?: =|:)?\s*(\d+)/i;
const lossRegex = /loss(?: =|:)?\s*([0-9]+)%/i;

async function connectSSH({ host, user, pass, port = 22, privateKey, readyTimeout = 10000 }) {
  const ssh = new NodeSSH();
  const opts = {
    host,
    username: user,
    port,
    readyTimeout,
    tryKeyboard: false,
  };
  if (privateKey) opts.privateKey = privateKey;
  else opts.password = pass;

  try {
    await ssh.connect(opts);
    return ssh;
  } catch (err) {
    try { ssh.dispose(); } catch (_) {}
    throw new Error(`SSH connection failed: ${String(err)}`);
  }
}

async function execWithTimeout(sshClient, cmd, { timeoutMs = 4000 } = {}) {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { sshClient.dispose(); } catch (_) {}
  }, timeoutMs);

  try {
    const res = await sshClient.execCommand(cmd, { cwd: "/" });
    const out = (res.stdout || "").trim();
    const err = (res.stderr || "").trim();
    if (timedOut) throw new Error("command timeout");
    return { out, err };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * getStarlinkStatus
 * Retorna um objeto com: { ok, connected, identity, internet, starlink, raw, checkedAt }
 */
export async function getStarlinkStatus({
  host,
  user,
  pass,
  port = Number(process.env.MIKROTIK_SSH_PORT || 22),
  privateKey,
  readyTimeout = Number(process.env.MIKROTIK_SSH_READY_TIMEOUT_MS || 10000),
  starIface = process.env.MIKROTIK_STARLINK_IFACE || "ether1",
  pingTarget = process.env.STARLINK_PING_TARGET || "1.1.1.1",
  pingCount = 5,
} = {}) {
  if (!host || !user || (!pass && !privateKey)) {
    throw new Error("Missing MIKROTIK_HOST / MIKROTIK_USER / MIKROTIK_PASS (or privateKey)");
  }

  if (Number(port) === 8728) {
    throw new Error(
      "Configured port is 8728 (RouterOS API). This function uses SSH. " +
      "If your device exposes only the RouterOS API (8728) request the API-implementation " +
      "or change the port to 22 and enable SSH on the MikroTik."
    );
  }

  const ssh = await connectSSH({ host, user, pass, port, privateKey, readyTimeout });

  try {
    // identity
    let identity = null;
    try {
      const identRes = await execWithTimeout(ssh, "/system identity print", { timeoutMs: 2000 });
      identity = (identRes.out || identRes.err || "").split(/\r?\n/).find(Boolean) || null;
    } catch (e) {
      console.warn("[mikrotik:getStarlinkStatus] identity read failed:", String(e));
    }

    // interface monitor
    let monitorOut = "";
    let linkUp = false;
    try {
      const monitorCmd = `/interface ethernet monitor ${starIface} once`;
      const monitorRes = await execWithTimeout(ssh, monitorCmd, { timeoutMs: 2500 });
      monitorOut = (monitorRes.out || monitorRes.err || "").trim().toLowerCase();
      linkUp = /link-ok|link ok|running|up|full-duplex|100mbps|1gbps/i.test(monitorOut) ||
               /rx:|tx:/i.test(monitorOut) || /speed:/i.test(monitorOut);
    } catch (e) {
      console.warn("[mikrotik:getStarlinkStatus] interface monitor failed (non-fatal):", String(e));
    }

    // ip on interface
    let ipOut = "";
    let ip = null;
    let ipNet = null;
    try {
      const ipCmd = `/ip address print where interface=${starIface}`;
      const ipRes = await execWithTimeout(ssh, ipCmd, { timeoutMs: 2000 });
      ipOut = (ipRes.out || ipRes.err || "").trim();
      const ipMatch = ipOut.match(ipRegex) || ipOut.match(ipv4Only);
      if (ipMatch) {
        ipNet = ipMatch[0];
        const onlyIp = ipNet.match(ipv4Only);
        ip = onlyIp ? onlyIp[0] : null;
      }
    } catch (e) {
      console.warn("[mikrotik:getStarlinkStatus] ip read failed (non-fatal):", String(e));
    }

    // ping
    let pingOut = "";
    let received = null;
    let lossPct = null;
    let rttMs = null;
    let pingOk = false;
    try {
      const pingCmd = `/ping address=${pingTarget} count=${pingCount}`;
      const pingRes = await execWithTimeout(ssh, pingCmd, { timeoutMs: 3500 });
      pingOut = (pingRes.out || pingRes.err || "").trim();
      const recMatch = pingOut.match(receivedRegex);
      if (recMatch) received = Number(recMatch[1]);
      const lossMatch = pingOut.match(lossRegex);
      if (lossMatch) lossPct = Number(lossMatch[1]);
      const rttMatch = pingOut.match(rttRegex);
      if (rttMatch) rttMs = Number(rttMatch[1] || rttMatch[2]);
      else {
        const mm = pingOut.match(/min\/avg\/max\/mdev\s*=\s*([0-9.,\/\s]+)/i);
        if (mm) {
          const parts = mm[1].split("/").map((s) => s.replace(",", ".").trim());
          if (parts[1]) rttMs = Number(parts[1]);
        }
      }
      pingOk = typeof received === "number" ? received > 0 : /bytes=|reply from|time=|ttl=/i.test(pingOut);
    } catch (e) {
      console.warn("[mikrotik:getStarlinkStatus] ping failed (non-fatal):", String(e));
    }

    const internet = {
      ok: !!pingOk,
      rtt_ms: Number.isFinite(rttMs) ? rttMs : null,
      received,
      loss_pct: lossPct,
    };

    const starlink = {
      iface: starIface,
      link: !!linkUp,
      ip: ip || null,
      ipNet: ipNet || null,
      ping_ok: !!pingOk,
      ping_raw: pingOut || null,
    };

    return {
      ok: true,
      connected: true,
      identity: identity || null,
      internet,
      starlink,
      raw: { monitorOut, ipOut, pingOut },
      checkedAt: new Date().toISOString(),
    };
  } finally {
    try { ssh.dispose(); } catch (_){}
  }
}

/**
 * revogarAcesso
 * Implementação genérica para executar ações de revogação no MikroTik via SSH.
 */
export async function revogarAcesso({
  host,
  user,
  pass,
  port = Number(process.env.MIKROTIK_SSH_PORT || 22),
  privateKey,
  readyTimeout = Number(process.env.MIKROTIK_SSH_READY_TIMEOUT_MS || 10000),
  ip,
  mac,
  sessionId,
  cmd,
  timeoutMs = 5000,
} = {}) {
  if (!host || !user || (!pass && !privateKey)) {
    throw new Error("Missing MIKROTIK_HOST / MIKROTIK_USER / MIKROTIK_PASS (or privateKey)");
  }

  if (Number(port) === 8728) {
    throw new Error("Configured port is 8728 (RouterOS API). revogarAcesso uses SSH. Use API implementation if needed.");
  }

  const ssh = await connectSSH({ host, user, pass, port, privateKey, readyTimeout });

  try {
    if (cmd && typeof cmd === "string") {
      const res = await execWithTimeout(ssh, cmd, { timeoutMs });
      return { ok: true, out: res.out, err: res.err };
    }

    const results = [];

    if (ip) {
      const removeIpCmd = `/ip firewall address-list remove [find address=${ip}]`;
      try { const r = await execWithTimeout(ssh, removeIpCmd, { timeoutMs }); results.push({ cmd: removeIpCmd, out: r.out, err: r.err }); }
      catch (e) { results.push({ cmd: removeIpCmd, error: String(e) }); }
    }

    if (mac) {
      const removeMacCmd = `/interface wireless access-list remove [find mac-address=${mac}]`;
      try { const r = await execWithTimeout(ssh, removeMacCmd, { timeoutMs }); results.push({ cmd: removeMacCmd, out: r.out, err: r.err }); }
      catch (e) { results.push({ cmd: removeMacCmd, error: String(e) }); }
    }

    if (sessionId) {
      const kickCmd = `/ppp active remove [find .id=${sessionId}]`;
      try { const r = await execWithTimeout(ssh, kickCmd, { timeoutMs }); results.push({ cmd: kickCmd, out: r.out, err: r.err }); }
      catch (e) { results.push({ cmd: kickCmd, error: String(e) }); }
    }

    if (results.length === 0) {
      return { ok: false, message: "Nenhuma ação executada. Forneça ip|mac|sessionId ou cmd." };
    }

    return { ok: true, results };
  } finally {
    try { ssh.dispose(); } catch (_){}
  }
}

/**
 * liberarAcesso
 * Adiciona um IP/MAC/usuário às listas de liberação.
 * Ajuste os comandos conforme seu setup (hotspot/ppp/firewall).
 */
export async function liberarAcesso({
  host,
  user,
  pass,
  port = Number(process.env.MIKROTIK_SSH_PORT || 22),
  privateKey,
  readyTimeout = Number(process.env.MIKROTIK_SSH_READY_TIMEOUT_MS || 10000),
  ip,
  mac,
  username,
  comment = "liberado_por_painel",
  cmd,
  timeoutMs = 5000,
} = {}) {
  if (!host || !user || (!pass && !privateKey)) {
    throw new Error("Missing MIKROTIK_HOST / MIKROTIK_USER / MIKROTIK_PASS (or privateKey)");
  }
  if (Number(port) === 8728) {
    throw new Error("Configured port is 8728 (RouterOS API). liberarAcesso uses SSH. Use API implementation if needed.");
  }

  const ssh = await connectSSH({ host, user, pass, port, privateKey, readyTimeout });

  try {
    if (cmd && typeof cmd === "string") {
      const res = await execWithTimeout(ssh, cmd, { timeoutMs });
      return { ok: true, out: res.out, err: res.err };
    }

    const results = [];

    if (ip) {
      // adiciona à address-list 'paid_clients' (ajuste se sua lista tem outro nome)
      const addIpCmd = `/ip firewall address-list add list=paid_clients address=${ip} comment="${comment}"`;
      try { const r = await execWithTimeout(ssh, addIpCmd, { timeoutMs }); results.push({ cmd: addIpCmd, out: r.out, err: r.err }); }
      catch (e) { results.push({ cmd: addIpCmd, error: String(e) }); }
    }

    if (mac) {
      // adiciona à access-list wireless (ajuste para seu caso)
      const addMacCmd = `/interface wireless access-list add mac-address=${mac} comment="${comment}"`;
      try { const r = await execWithTimeout(ssh, addMacCmd, { timeoutMs }); results.push({ cmd: addMacCmd, out: r.out, err: r.err }); }
      catch (e) { results.push({ cmd: addMacCmd, error: String(e) }); }
    }

    if (username) {
      // exemplo genérico: adicionar usuário no hotspot (ajuste conforme necessário)
      const addUserCmd = `/ip hotspot user add name=${username} password=${username}`;
      try { const r = await execWithTimeout(ssh, addUserCmd, { timeoutMs }); results.push({ cmd: addUserCmd, out: r.out, err: r.err }); }
      catch (e) { results.push({ cmd: addUserCmd, error: String(e) }); }
    }

    if (results.length === 0) {
      return { ok: false, message: "Nenhuma ação executada. Forneça ip|mac|username ou cmd." };
    }

    return { ok: true, results };
  } finally {
    try { ssh.dispose(); } catch (_){}
  }
}

/**
 * liberarCliente
 * Alias específico para liberar um cliente (delegado para liberarAcesso).
 * Mantido porque algumas rotas importam especificamente liberarCliente.
 */
export async function liberarCliente(options = {}) {
  return liberarAcesso(options);
}

/**
 * listPppActive
 * Lista sessões PPP ativas e tenta parse simples do output.
 */
export async function listPppActive({
  host,
  user,
  pass,
  port = Number(process.env.MIKROTIK_SSH_PORT || 22),
  privateKey,
  readyTimeout = Number(process.env.MIKROTIK_SSH_READY_TIMEOUT_MS || 10000),
  timeoutMs = 4000,
} = {}) {
  if (!host || !user || (!pass && !privateKey)) {
    throw new Error("Missing MIKROTIK_HOST / MIKROTIK_USER / MIKROTIK_PASS (or privateKey)");
  }
  if (Number(port) === 8728) {
    throw new Error("Configured port is 8728 (RouterOS API). listPppActive uses SSH. Use API implementation if needed.");
  }

  const ssh = await connectSSH({ host, user, pass, port, privateKey, readyTimeout });

  try {
    const res = await execWithTimeout(ssh, `/ppp active print`, { timeoutMs });
    const raw = (res.out || res.err || "").trim();

    // parse: cada linha com "name=" ou contendo key=value separemos
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const items = [];

    for (const line of lines) {
      // tenta capturar pares key=value
      const obj = {};
      const parts = line.split(/\s+/);
      for (const p of parts) {
        if (p.includes("=")) {
          const [k, ...rest] = p.split("=");
          obj[k.trim()] = rest.join("=").trim();
        } else {
          // linha pode começar com índice, ignoramos
        }
      }
      // se não achou key=, armazena como raw
      if (Object.keys(obj).length === 0) {
        items.push({ raw: line });
      } else {
        items.push(obj);
      }
    }

    return { ok: true, raw, items };
  } finally {
    try { ssh.dispose(); } catch (_){}
  }
}

export default {
  getStarlinkStatus,
  revogarAcesso,
  liberarAcesso,
  liberarCliente,
  listPppActive,
};

// src/lib/mikrotik.js

// --- Regex úteis ---
const ipRegex = /(\d{1,3}\.){3}\d{1,3}\/\d{1,2}/;
const ipv4Only = /(\d{1,3}\.){3}\d{1,3}/;
const rttRegex = /avg(?:\s*=|:)\s*([0-9.,]+)\s*ms|time=([0-9.,]+)\s*ms/i;
const receivedRegex = /received(?: =|:)?\s*(\d+)/i;
const lossRegex = /loss(?: =|:)?\s*([0-9]+)%/i;

// --- SSH helpers ---
async function connectSSH({ host, user, pass, port = 22, privateKey, readyTimeout = 10000 }) {
  const { NodeSSH } = await import("node-ssh"); // import dinâmico
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

/** ============================
 * getStarlinkStatus
 * ============================ */
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
    throw new Error("Configured port is 8728 (RouterOS API). This function uses SSH.");
  }

  const ssh = await connectSSH({ host, user, pass, port, privateKey, readyTimeout });

  try {
    let identity = null;
    try {
      const identRes = await execWithTimeout(ssh, "/system identity print", { timeoutMs: 2000 });
      identity = (identRes.out || identRes.err || "").split(/\r?\n/).find(Boolean) || null;
    } catch {}

    let monitorOut = "";
    let linkUp = false;
    try {
      const monitorCmd = `/interface ethernet monitor ${starIface} once`;
      const monitorRes = await execWithTimeout(ssh, monitorCmd, { timeoutMs: 2500 });
      monitorOut = (monitorRes.out || monitorRes.err || "").trim().toLowerCase();
      linkUp = /link-ok|running|up|1gbps|100mbps/.test(monitorOut);
    } catch {}

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
    } catch {}

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
      pingOk = typeof received === "number" ? received > 0 : /reply from|time=/.test(pingOut);
    } catch {}

    return {
      ok: true,
      connected: true,
      identity,
      internet: { ok: pingOk, rtt_ms: rttMs, received, loss_pct: lossPct },
      starlink: { iface: starIface, link: linkUp, ip, ipNet, ping_ok: pingOk },
      raw: { monitorOut, ipOut, pingOut },
      checkedAt: new Date().toISOString(),
    };
  } finally {
    try { ssh.dispose(); } catch (_){}
  }
}

/** ============================
 * revogarAcesso
 * ============================ */
export async function revogarAcesso({ host, user, pass, ip, mac, sessionId, cmd, ...rest } = {}) {
  const ssh = await connectSSH({ host, user, pass, ...rest });
  try {
    const results = [];
    if (cmd) {
      const r = await execWithTimeout(ssh, cmd, { timeoutMs: rest.timeoutMs || 5000 });
      return { ok: true, out: r.out, err: r.err };
    }
    if (ip) {
      const removeIpCmd = `/ip firewall address-list remove [find address=${ip}]`;
      results.push(await execWithTimeout(ssh, removeIpCmd, { timeoutMs: rest.timeoutMs || 5000 }));
    }
    if (mac) {
      const removeMacCmd = `/interface wireless access-list remove [find mac-address=${mac}]`;
      results.push(await execWithTimeout(ssh, removeMacCmd, { timeoutMs: rest.timeoutMs || 5000 }));
    }
    if (sessionId) {
      const kickCmd = `/ppp active remove [find .id=${sessionId}]`;
      results.push(await execWithTimeout(ssh, kickCmd, { timeoutMs: rest.timeoutMs || 5000 }));
    }
    return { ok: true, results };
  } finally {
    try { ssh.dispose(); } catch (_){}
  }
}

/** ============================
 * liberarAcesso
 * ============================ */
export async function liberarAcesso({ host, user, pass, ip, mac, username, comment = "liberado_por_painel", cmd, ...rest } = {}) {
  const ssh = await connectSSH({ host, user, pass, ...rest });
  try {
    const results = [];
    if (cmd) {
      const r = await execWithTimeout(ssh, cmd, { timeoutMs: rest.timeoutMs || 5000 });
      return { ok: true, out: r.out, err: r.err };
    }
    if (ip) {
      const addIpCmd = `/ip firewall address-list add list=paid_clients address=${ip} comment="${comment}"`;
      results.push(await execWithTimeout(ssh, addIpCmd, { timeoutMs: rest.timeoutMs || 5000 }));
    }
    if (mac) {
      const addMacCmd = `/interface wireless access-list add mac-address=${mac} comment="${comment}"`;
      results.push(await execWithTimeout(ssh, addMacCmd, { timeoutMs: rest.timeoutMs || 5000 }));
    }
    if (username) {
      const addUserCmd = `/ip hotspot user add name=${username} password=${username}`;
      results.push(await execWithTimeout(ssh, addUserCmd, { timeoutMs: rest.timeoutMs || 5000 }));
    }
    return { ok: true, results };
  } finally {
    try { ssh.dispose(); } catch (_){}
  }
}

/** ============================
 * listPppActive
 * ============================ */
export async function listPppActive({ host, user, pass, ...rest } = {}) {
  const ssh = await connectSSH({ host, user, pass, ...rest });
  try {
    const res = await execWithTimeout(ssh, `/ppp active print`, { timeoutMs: rest.timeoutMs || 4000 });
    return { ok: true, raw: res.out || res.err };
  } finally {
    try { ssh.dispose(); } catch (_){}
  }
}

// === ALIASES (mantidos como const para evitar duplicidade de export) ===
const revogarCliente = (options = {}) => revogarAcesso(options);
const liberarClienteNoMikrotik = (options = {}) => liberarAcesso(options);
const liberarCliente = (options = {}) => liberarAcesso(options);

// Export default com tudo agrupado
export default {
  getStarlinkStatus,
  revogarAcesso,
  revogarCliente,
  liberarAcesso,
  liberarCliente,
  liberarClienteNoMikrotik,
  listPppActive,
};

// Export nomeado (para compatibilidade com imports existentes)
export {
  getStarlinkStatus,
  revogarAcesso,
  revogarCliente,
  liberarAcesso,
  liberarCliente,
  liberarClienteNoMikrotik,
  listPppActive,
};

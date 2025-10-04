// src/lib/mikrotik.js

// --- Regex úteis ---
const ipRegex = /(\d{1,3}\.){3}\d{1,3}\/\d{1,2}/;
const ipv4Only = /(\d{1,3}\.){3}\d{1,3}/;
const rttRegex = /avg(?:\s*=|:)\s*([0-9.,]+)\s*ms|time=([0-9.,]+)\s*ms/i;
const receivedRegex = /received(?: =|:)?\s*(\d+)/i;
const lossRegex = /loss(?: =|:)?\s*([0-9]+)%/i;

// --- SSH helpers ---
async function connectSSH({ host, user, pass, port = 22, privateKey, readyTimeout = 10000 }) {
  const { NodeSSH } = await import("node-ssh"); // import dinâmico p/ evitar bundler mexendo em binário
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
async function getStarlinkStatus({
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
    // identity
    let identity = null;
    try {
      const identRes = await execWithTimeout(ssh, "/system identity print", { timeoutMs: 2000 });
      identity = (identRes.out || identRes.err || "").split(/\r?\n/).find(Boolean) || null;
    } catch {}

    // iface monitor
    let monitorOut = "";
    let linkUp = false;
    try {
      const monitorCmd = `/interface ethernet monitor ${starIface} once`;
      const monitorRes = await execWithTimeout(ssh, monitorCmd, { timeoutMs: 2500 });
      monitorOut = (monitorRes.out || monitorRes.err || "").trim().toLowerCase();
      linkUp = /link-ok|running|up|1gbps|100mbps/.test(monitorOut)
        || /rx:|tx:|speed:/i.test(monitorOut);
    } catch {}

    // ip on iface
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
    } catch {}

    return {
      ok: true,
      connected: true,
      identity,
      internet: { ok: pingOk, rtt_ms: rttMs ?? null, received, loss_pct: lossPct },
      starlink: { iface: starIface, link: linkUp, ip: ip ?? null, ipNet: ipNet ?? null, ping_ok: pingOk, ping_raw: pingOut || null },
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
async function revogarAcesso({
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
    throw new Error("Configured port is 8728 (RouterOS API). revogarAcesso uses SSH.");
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

/** ============================
 * liberarAcesso
 * ============================ */
async function liberarAcesso({
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
    throw new Error("Configured port is 8728 (RouterOS API). liberarAcesso uses SSH.");
  }

  const ssh = await connectSSH({ host, user, pass, port, privateKey, readyTimeout });

  try {
    if (cmd && typeof cmd === "string") {
      const res = await execWithTimeout(ssh, cmd, { timeoutMs });
      return { ok: true, out: res.out, err: res.err };
    }

    const results = [];

    if (ip) {
      const addIpCmd = `/ip firewall address-list add list=paid_clients address=${ip} comment="${comment}"`;
      try { const r = await execWithTimeout(ssh, addIpCmd, { timeoutMs }); results.push({ cmd: addIpCmd, out: r.out, err: r.err }); }
      catch (e) { results.push({ cmd: addIpCmd, error: String(e) }); }
    }

    if (mac) {
      const addMacCmd = `/interface wireless access-list add mac-address=${mac} comment="${comment}"`;
      try { const r = await execWithTimeout(ssh, addMacCmd, { timeoutMs }); results.push({ cmd: addMacCmd, out: r.out, err: r.err }); }
      catch (e) { results.push({ cmd: addMacCmd, error: String(e) }); }
    }

    if (username) {
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

/** ============================
 * listPppActive
 * ============================ */
async function listPppActive({
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
    throw new Error("Configured port is 8728 (RouterOS API). listPppActive uses SSH.");
  }

  const ssh = await connectSSH({ host, user, pass, port, privateKey, readyTimeout });

  try {
    const res = await execWithTimeout(ssh, `/ppp active print`, { timeoutMs });
    const raw = (res.out || res.err || "").trim();

    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const items = [];

    for (const line of lines) {
      const obj = {};
      const parts = line.split(/\s+/);
      for (const p of parts) {
        if (p.includes("=")) {
          const [k, ...rest] = p.split("=");
          obj[k.trim()] = rest.join("=").trim();
        }
      }
      if (Object.keys(obj).length === 0) items.push({ raw: line });
      else items.push(obj);
    }

    return { ok: true, raw, items };
  } finally {
    try { ssh.dispose(); } catch (_){}
  }
}

// === ALIASES (const; sem export direto para evitar duplicidade) ===
const revogarCliente = (options = {}) => revogarAcesso(options);
const liberarClienteNoMikrotik = (options = {}) => liberarAcesso(options);
const liberarCliente = (options = {}) => liberarAcesso(options);

// === Exports centralizados (nomeados + default) ===
export {
  getStarlinkStatus,
  revogarAcesso,
  revogarCliente,
  liberarAcesso,
  liberarCliente,
  liberarClienteNoMikrotik,
  listPppActive,
};

export default {
  getStarlinkStatus,
  revogarAcesso,
  revogarCliente,
  liberarAcesso,
  liberarCliente,
  liberarClienteNoMikrotik,
  listPppActive,
};

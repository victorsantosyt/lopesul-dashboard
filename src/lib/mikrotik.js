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
    // garante cleanup se houver erro durante connect
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
 *
 * Observação importante: esta implementação usa SSH. Se o seu MikroTik
 * estiver expondo apenas a RouterOS API (porta 8728), não funcionará — nesse
 * caso solicite a versão que usa a API binary (node-routeros / routeros-client).
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
  // validações básicas
  if (!host || !user || (!pass && !privateKey)) {
    throw new Error("Missing MIKROTIK_HOST / MIKROTIK_USER / MIKROTIK_PASS (or privateKey)");
  }

  // Segurança: se a porta for 8728 (RouterOS API binary), avisa e aborta.
  // A API binary não aceita conexões SSH — precisa de outra biblioteca.
  if (Number(port) === 8728) {
    throw new Error(
      "Configured port is 8728 (RouterOS API). This function uses SSH. " +
      "If your device exposes only the RouterOS API (8728) request the API-implementation " +
      "or change the port to 22 and enable SSH on the MikroTik."
    );
  }

  // conecta via SSH (lança erro se falhar)
  const ssh = await connectSSH({
    host,
    user,
    pass,
    port,
    privateKey,
    readyTimeout,
  });

  try {
    // identity (tenta ler, mas não falha a execução se der erro)
    let identity = null;
    try {
      const identRes = await execWithTimeout(ssh, "/system identity print", { timeoutMs: 2000 });
      identity = (identRes.out || identRes.err || "").split(/\r?\n/).find(Boolean) || null;
    } catch (e) {
      // não bloqueia; registra para debug
      console.warn("[mikrotik:getStarlinkStatus] identity read failed:", String(e));
    }

    // interface monitor (output varia por versão do RouterOS)
    let monitorOut = "";
    let linkUp = false;
    try {
      const monitorCmd = `/interface ethernet monitor ${starIface} once`;
      const monitorRes = await execWithTimeout(ssh, monitorCmd, { timeoutMs: 2500 });
      monitorOut = (monitorRes.out || monitorRes.err || "").trim().toLowerCase();
      linkUp =
        /link-ok|link ok|running|up|full-duplex|100mbps|1gbps/i.test(monitorOut) ||
        /rx:|tx:/i.test(monitorOut) ||
        /speed:/i.test(monitorOut);
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
      raw: {
        monitorOut,
        ipOut,
        pingOut,
      },
      checkedAt: new Date().toISOString(),
    };
  } finally {
    try { ssh.dispose(); } catch (_){}
  }
}

export default {
  getStarlinkStatus,
};

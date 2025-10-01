// src/app/api/mikrotik/starlink/route.js
import { NextResponse } from "next/server";
import { NodeSSH } from "node-ssh";

const ipV4Only = /(\d{1,3}\.){3}\d{1,3}/;
const receivedRegex = /received(?:\s*=)?\s*(\d+)/i;
const lossRegex = /loss(?:\s*=)?\s*([0-9]+)%/i;
const rttRegex = /avg(?:\s*=|:)\s*([0-9.,]+)\s*ms|time=([0-9.,]+)\s*ms/i;

/** exec simple com timeout seguro (fecha conexão se timeout) */
async function execWithTimeout(ssh, cmd, { timeoutMs = 4000 } = {}) {
  let timer;
  try {
    const p = ssh.execCommand(cmd, { cwd: "/" });
    const timeout = new Promise((_, rej) =>
      (timer = setTimeout(() => {
        try { ssh.dispose(); } catch (e) {}
        rej(new Error("command timeout"));
      }, timeoutMs))
    );
    const res = await Promise.race([p, timeout]);
    clearTimeout(timer);
    return { out: (res.stdout || "").trim(), err: (res.stderr || "").trim() };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  if (url.searchParams.get("mock") === "1") {
    return NextResponse.json({
      source: "mikrotik",
      ifaceMonitor: "mock",
      ipInfo: "100.64.1.23/10",
      pingOut: "mock",
      flags: { hasLink: true, hasIP: true, pingSuccess: true },
      status: "online",
      checkedAt: new Date().toISOString(),
    });
  }

  const HOST = process.env.MIKROTIK_HOST;
  const USER = process.env.MIKROTIK_USER;
  const PASS = process.env.MIKROTIK_PASS;
  const PORT = Number(process.env.MIKROTIK_SSH_PORT || 22);
  const IFACE = process.env.MIKROTIK_STARLINK_IFACE || "ether1";
  const PING_TARGET = process.env.STARLINK_PING_TARGET || "1.1.1.1";
  const SSH_READY_TIMEOUT = Number(process.env.MIKROTIK_SSH_READY_TIMEOUT_MS || 10000);

  if (!HOST || !USER || (!PASS && !process.env.MIKROTIK_PRIVATE_KEY)) {
    return NextResponse.json({ ok: false, error: "MIKROTIK_HOST / MIKROTIK_USER / MIKROTIK_PASS (ou MIKROTIK_PRIVATE_KEY) não configurados" }, { status: 400 });
  }

  // se estiver usando 8728, avisar (é API binary, não SSH)
  if (PORT === 8728) {
    return NextResponse.json({
      ok: false,
      error: "MIKROTIK_SSH_PORT está configurado como 8728 (RouterOS API). Este handler usa SSH (porta 22).",
      hint: "Mude para 22/SSH ou migre para implementação via RouterOS API (node-routeros)."
    }, { status: 501 });
  }

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: HOST,
      username: USER,
      password: PASS,
      port: PORT,
      readyTimeout: SSH_READY_TIMEOUT,
      tryKeyboard: false,
      privateKey: process.env.MIKROTIK_PRIVATE_KEY || undefined,
    });

    // 1) monitor interface (saída varia entre versões)
    let ifaceMonitorOut = "";
    try {
      const im = await execWithTimeout(ssh, `/interface ethernet monitor ${IFACE} once`, { timeoutMs: 2500 });
      ifaceMonitorOut = (im.out || im.err || "").trim();
    } catch (e) {
      // não bloqueia a resposta — só marca como sem link possivelmente
      ifaceMonitorOut = String(e.message || e);
    }

    // 2) ip info
    let ipInfoOut = "";
    try {
      const ipRes = await execWithTimeout(ssh, `/ip address print where interface=${IFACE}`, { timeoutMs: 2000 });
      ipInfoOut = (ipRes.out || ipRes.err || "").trim();
    } catch (e) {
      ipInfoOut = String(e.message || e);
    }

    // 3) ping
    let pingOut = "";
    try {
      const p = await execWithTimeout(ssh, `/ping address=${PING_TARGET} count=3`, { timeoutMs: 4000 });
      pingOut = (p.out || p.err || "").trim();
    } catch (e) {
      pingOut = String(e.message || e);
    }

    // parse flags robustos
    const hasLink = /link|link-ok|up|running|full-duplex|100mbps|1gbps/i.test(ifaceMonitorOut) || /rx:|tx:/i.test(ifaceMonitorOut);
    const hasIP = ipV4Only.test(ipInfoOut);
    const pingSuccess = /time=|bytes=|reply from|received\s*=\s*\d+/i.test(pingOut);

    // decide status
    let status = "offline";
    if (hasLink && hasIP && pingSuccess) status = "online";
    else if ((hasLink && (hasIP || pingSuccess)) || (hasIP && pingSuccess)) status = "degraded";

    // tenta extrair rtt/received para telemetry (opcional)
    let rttMs = null;
    const rttMatch = pingOut.match(rttRegex);
    if (rttMatch) rttMs = Number(rttMatch[1] || rttMatch[2]) || null;
    const recMatch = pingOut.match(receivedRegex);
    const received = recMatch ? Number(recMatch[1]) : null;

    // cleanup
    try { ssh.dispose(); } catch (e) {}

    return NextResponse.json({
      source: "mikrotik",
      ifaceMonitor: ifaceMonitorOut,
      ipInfo: ipInfoOut,
      pingOut,
      flags: { hasLink, hasIP, pingSuccess, received, rttMs },
      status,
      checkedAt: new Date().toISOString(),
    }, { status: 200 });
  } catch (err) {
    try { ssh.dispose(); } catch (e) {}
    console.error("[mikrotik/starlink] erro:", String(err));
    return NextResponse.json({ ok: false, error: "Erro ao conectar/consultar MikroTik", detail: String(err) }, { status: 502 });
  }
}

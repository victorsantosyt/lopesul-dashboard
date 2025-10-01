// src/app/api/mikrotik/ping/route.js
import { NextResponse } from "next/server";
import { NodeSSH } from "node-ssh";

const ipRegex = /(\d{1,3}\.){3}\d{1,3}\/\d{1,2}/;
const ipv4Only = /(\d{1,3}\.){3}\d{1,3}/;
const rttRegex = /avg(?:\s*=|:)\s*([0-9.,]+)\s*ms|time=([0-9.,]+)\s*ms/i;
const receivedRegex = /received(?: =|:)?\s*(\d+)/i;
const lossRegex = /loss(?: =|:)?\s*([0-9]+)%/i;

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

export async function GET(request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("mock") === "1") {
      console.log("[MIKROTIK] mock response requested");
      return NextResponse.json({
        ok: true,
        connected: true,
        identity: "Lopesul-Hotspot (mock)",
        internet: { ok: true, rtt_ms: 24, received: 5, loss_pct: 0 },
        starlink: { iface: "ether1", link: true, ip: "100.64.1.23", ipNet: "100.64.1.23/10", ping_ok: true },
        raw: {},
        checkedAt: new Date().toISOString(),
      });
    }

    console.log("[MIKROTIK] ping handler called", new Date().toISOString());

    // env
    const HOST = process.env.MIKROTIK_HOST;
    const USER = process.env.MIKROTIK_USER;
    const PASS = process.env.MIKROTIK_PASS;
    const PRIVATE_KEY = process.env.MIKROTIK_PRIVATE_KEY || undefined;
    const PORT = Number(process.env.MIKROTIK_SSH_PORT || 22);
    const STAR_IFACE = process.env.MIKROTIK_STARLINK_IFACE || "ether1";
    const PING_TARGET = process.env.STARLINK_PING_TARGET || "1.1.1.1";
    const SSH_READY_TIMEOUT = Number(process.env.MIKROTIK_SSH_READY_TIMEOUT_MS || 10000);

    if (!HOST || !USER || (!PASS && !PRIVATE_KEY)) {
      return NextResponse.json(
        { ok: false, error: "MIKROTIK_HOST / MIKROTIK_USER / MIKROTIK_PASS (ou MIKROTIK_PRIVATE_KEY) não configurados" },
        { status: 400 }
      );
    }

    // quick guard: if port looks like RouterOS API (8728) warn/exit
    if (PORT === 8728) {
      return NextResponse.json({
        ok: false,
        error:
          "Configured port is 8728 (RouterOS API). This route uses SSH (node-ssh). " +
          "Se você precisa falar com a API binary (8728), troque a implementação para usar a lib RouterOS API (ex: node-routeros).",
        hint: "Para testar localmente com SSH, configure MIKROTIK_SSH_PORT=22 e habilite SSH no MikroTik, ou use ?mock=1 para mock."
      }, { status: 501 });
    }

    const ssh = new NodeSSH();
    const connectOpts = {
      host: HOST,
      username: USER,
      port: PORT,
      readyTimeout: SSH_READY_TIMEOUT,
      tryKeyboard: false,
    };
    if (PRIVATE_KEY) connectOpts.privateKey = PRIVATE_KEY;
    else connectOpts.password = PASS;

    // try connect
    try {
      await ssh.connect(connectOpts);
    } catch (err) {
      console.error("[MIKROTIK] ssh.connect error:", String(err));
      try { ssh.dispose(); } catch (_) {}
      return NextResponse.json({ ok: false, error: "Erro conectando via SSH ao MikroTik", detail: String(err) }, { status: 502 });
    }

    // identity
    let identity = null;
    try {
      const identRes = await execWithTimeout(ssh, "/system identity print", { timeoutMs: 2000 });
      identity = (identRes.out || identRes.err || "").split(/\r?\n/).find(Boolean) || null;
    } catch (e) {
      console.warn("[MIKROTIK] identity read failed:", String(e));
    }

    // interface monitor (some RouterOS versions may print different outputs)
    let monitorOut = "";
    let linkUp = false;
    try {
      const monitorCmd = `/interface ethernet monitor ${STAR_IFACE} once`;
      const monitorRes = await execWithTimeout(ssh, monitorCmd, { timeoutMs: 2500 });
      monitorOut = (monitorRes.out || monitorRes.err || "").trim().toLowerCase();
      linkUp =
        /link-ok|link ok|running|up|full-duplex|100mbps|1gbps/i.test(monitorOut) ||
        /rx:|tx:/i.test(monitorOut) ||
        /speed:/i.test(monitorOut);
    } catch (e) {
      console.warn("[MIKROTIK] interface monitor failed (non-fatal):", String(e));
    }

    // ip on interface
    let ipOut = "";
    let ip = null;
    let ipNet = null;
    try {
      const ipCmd = `/ip address print where interface=${STAR_IFACE}`;
      const ipRes = await execWithTimeout(ssh, ipCmd, { timeoutMs: 2000 });
      ipOut = (ipRes.out || ipRes.err || "").trim();
      const ipMatch = ipOut.match(ipRegex) || ipOut.match(ipv4Only);
      if (ipMatch) {
        ipNet = ipMatch[0];
        const onlyIp = ipNet.match(ipv4Only);
        ip = onlyIp ? onlyIp[0] : null;
      }
    } catch (e) {
      console.warn("[MIKROTIK] ip read failed (non-fatal):", String(e));
    }

    // ping external
    let pingOut = "";
    let received = null;
    let lossPct = null;
    let rttMs = null;
    let pingOk = false;
    try {
      const pingCmd = `/ping address=${PING_TARGET} count=5`;
      const pingRes = await execWithTimeout(ssh, pingCmd, { timeoutMs: 4000 });
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
      console.warn("[MIKROTIK] ping failed (non-fatal):", String(e));
    }

    // cleanup
    try { ssh.dispose(); } catch (_) {}

    const internet = {
      ok: !!pingOk,
      rtt_ms: Number.isFinite(rttMs) ? rttMs : null,
      received,
      loss_pct: lossPct,
    };

    const starlink = {
      iface: STAR_IFACE,
      link: !!linkUp,
      ip: ip || null,
      ipNet: ipNet || null,
      ping_ok: !!pingOk,
      ping_raw: pingOut || null,
    };

    const body = {
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

    console.log("[MIKROTIK] check complete", { identity: body.identity, star_link: starlink.link, ping_ok: starlink.ping_ok });
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("[MIKROTIK] unexpected error:", String(err));
    return NextResponse.json({ ok: false, error: "Erro interno ao consultar MikroTik", detail: String(err) }, { status: 500 });
  }
}

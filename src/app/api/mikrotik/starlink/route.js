// src/app/api/mikrotik/starlink/route.js
import { NextResponse } from "next/server";
import MikroNode from "mikronode-ng2";

export async function GET(req) {
  const HOST = process.env.MIKROTIK_HOST;
  const PORT = Number(process.env.MIKROTIK_PORT || 28728);
  const USER = process.env.MIKROTIK_USER;
  const PASS = process.env.MIKROTIK_PASS;
  const IFACE = process.env.MIKROTIK_STARLINK_IFACE || "ether1";
  const TARGET = process.env.STARLINK_PING_TARGET || "1.1.1.1";

  if (!HOST || !USER || !PASS) {
    return NextResponse.json(
      { ok: false, error: "MIKROTIK_HOST/USER/PASS não configurados" },
      { status: 400 }
    );
  }

  try {
    console.log(`[STARLINK] Conectando API RouterOS em ${HOST}:${PORT}`);

    const conn = new MikroNode.Connection({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASS,
      timeout: 5000,
    });

    await conn.connect();
    const chan = conn.openChannel();

    // 1️⃣ interface monitor
    const ifaceRes = await chan.write(`/interface/ethernet/print where name=${IFACE}`);
    const ifaceData = ifaceRes.data.toString();

    // 2️⃣ IP atribuído
    const ipRes = await chan.write(`/ip/address/print where interface=${IFACE}`);
    const ipData = ipRes.data.toString();
    const ipMatch = ipData.match(/(\d{1,3}\.){3}\d{1,3}/);
    const ip = ipMatch ? ipMatch[0] : null;

    // 3️⃣ Ping
    const pingRes = await chan.write(`/ping address=${TARGET} count=3`);
    const pingData = pingRes.data.toString();

    const rttMatch = pingData.match(/time=(\d+(?:\.\d+)?)ms/);
    const rttMs = rttMatch ? parseFloat(rttMatch[1]) : null;
    const pingOk = /bytes=|time=|ttl=/i.test(pingData);

    // 4️⃣ Status
    const linkOk = /running|up|link-ok|full-duplex|100mbps|1gbps/i.test(ifaceData);
    const hasIP = !!ip;
    const status = linkOk && hasIP && pingOk ? "online" : "offline";

    conn.close(true);

    return NextResponse.json({
      source: "mikrotik-api",
      iface: IFACE,
      ip,
      flags: { linkOk, hasIP, pingOk },
      rttMs,
      status,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[STARLINK] erro:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 502 });
  }
}

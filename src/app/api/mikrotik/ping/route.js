// src/app/api/mikrotik/ping/route.js
import { NextResponse } from "next/server";
import MikroNode from "mikronode-ng2";

export async function GET() {
  const HOST = process.env.MIKROTIK_HOST;
  const PORT = Number(process.env.MIKROTIK_PORT || 28728);
  const USER = process.env.MIKROTIK_USER;
  const PASS = process.env.MIKROTIK_PASS;
  const TARGET = process.env.STARLINK_PING_TARGET || "1.1.1.1";

  if (!HOST || !USER || !PASS) {
    return NextResponse.json({ ok: false, error: "Variáveis MIKROTIK_HOST/USER/PASS não configuradas" }, { status: 400 });
  }

  try {
    console.log("[MIKROTIK] Conectando via API em", `${HOST}:${PORT}`);
    const conn = new MikroNode.Connection({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASS,
      timeout: 5000,
    });

    await conn.connect();
    const chan = conn.openChannel();

    // executa ping nativo via API RouterOS
    const res = await chan.write(`/ping address=${TARGET} count=3`);
    const data = res.data.toString();
    const match = data.match(/time=(\d+(?:\.\d+)?)ms/);
    const rtt = match ? parseFloat(match[1]) : null;

    conn.close(true);
    console.log("[MIKROTIK] Ping OK:", { rtt });

    return NextResponse.json({
      ok: true,
      connected: true,
      rtt_ms: rtt,
      raw: data,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[MIKROTIK] API error:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 502 });
  }
}

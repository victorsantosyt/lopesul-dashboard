// src/app/api/mikrotik/ppp-active/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import MikroNode from "mikronode-ng2";

const yes = (v) => ["1", "true", "yes", "on"].includes(String(v ?? "").toLowerCase());

function getCfg() {
  const host = process.env.MIKROTIK_HOST;
  const user = process.env.MIKROTIK_USER;
  const password = process.env.MIKROTIK_PASS;
  const port = Number(process.env.MIKROTIK_PORT || 28728);
  const timeout = Number(process.env.MIKROTIK_TIMEOUT_MS || 8000);
  const ssl = yes(process.env.MIKROTIK_SSL) || yes(process.env.MIKROTIK_SECURE);

  return { host, user, password, port, ssl, timeout };
}

function mapRow(x) {
  return {
    id: x[".id"] || x.id || null,
    name: x.name || null,
    address: x.address || null, // IP remoto
    callerId: x["caller-id"] || x.callerId || null,
    service: x.service || null,
    uptime: x.uptime || null,
    encoding: x.encoding || null,
  };
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const limitRaw = parseInt(url.searchParams.get("limit") || "200", 10);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 200, 500));

    const cfg = getCfg();
    if (!cfg.host || !cfg.user || !cfg.password) {
      return NextResponse.json(
        { ok: false, rows: [], count: 0, error: "Configuração MikroTik ausente (host/user/password)" },
        { status: 400 }
      );
    }

    const conn = new MikroNode.Connection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      timeout: cfg.timeout,
    });

    await conn.connect();
    const chan = conn.openChannel();

    const res = await chan.write("/ppp/active/print");
    conn.close(true);

    const parsed = Array.isArray(res) ? res : [];
    const rows = parsed.slice(0, limit).map(mapRow);

    return NextResponse.json({ ok: true, count: rows.length, rows }, { status: 200 });
  } catch (e) {
    console.error("GET /api/mikrotik/ppp-active error:", e.message);
    const status = /timeout|ECONNREFUSED|EHOSTUNREACH/i.test(e.message) ? 502 : 500;
    return NextResponse.json(
      { ok: false, rows: [], error: e.message || "Falha ao consultar PPP Active" },
      { status }
    );
  }
}

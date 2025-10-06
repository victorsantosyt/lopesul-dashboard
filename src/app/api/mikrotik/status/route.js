// src/app/api/mikrotik/status/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import MikroNode from "mikronode-ng2"; // leve e direto para API do Mikrotik

// helpers de env
const yes = (v) => ["1", "true", "yes", "on"].includes(String(v ?? "").toLowerCase());
function getCfg() {
  const host = process.env.MIKROTIK_HOST;
  const user = process.env.MIKROTIK_USER;
  const password = process.env.MIKROTIK_PASS;
  const port = Number(process.env.MIKROTIK_PORT || 28728); // via túnel proxy
  const timeout = Number(process.env.MIKROTIK_TIMEOUT_MS || 8000);
  const ssl = yes(process.env.MIKROTIK_SSL) || yes(process.env.MIKROTIK_SECURE);
  const defaultList = process.env.MIKROTIK_PAID_LIST || "paid_clients";
  return { host, user, password, port, ssl, timeout, defaultList };
}

export async function GET(req) {
  const cfg = getCfg();

  if (!cfg.host || !cfg.user || !cfg.password) {
    return NextResponse.json(
      { ok: false, error: "Configuração Mikrotik ausente (host/user/password)" },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const list = searchParams.get("list") || cfg.defaultList;
    const limitRaw = parseInt(searchParams.get("limit") || "100", 10);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 100, 200));

    // conexão direta via proxy
    const conn = new MikroNode.Connection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      timeout: cfg.timeout,
    });

    await conn.connect();
    const chan = conn.openChannel();

    // pega o nome do roteador
    const ident = await chan.write("/system/identity/print");
    const identity =
      Array.isArray(ident) && ident[0]?.name ? ident[0].name : "Desconhecido";

    // lista de clientes pagos
    const raw = await chan.write([
      "/ip/firewall/address-list/print",
      `?list=${list}`,
    ]);

    conn.close(true);

    const items = (Array.isArray(raw) ? raw : [])
      .slice(0, limit)
      .map((x) => ({
        id: x[".id"] || x.id || null,
        address: x.address || null,
        list: x.list || null,
        comment: x.comment || null,
        disabled: x.disabled === "true" || x.disabled === true,
        creationTime: x["creation-time"] || null,
      }));

    return NextResponse.json({
      ok: true,
      identity,
      list,
      count: items.length,
      items,
    });
  } catch (e) {
    console.error("GET /api/mikrotik/status error:", e?.message);
    const status = /timeout|ECONNREFUSED|EHOSTUNREACH/i.test(e.message)
      ? 502
      : 500;
    return NextResponse.json(
      { ok: false, error: e.message || "Falha ao consultar status do Mikrotik" },
      { status }
    );
  }
}

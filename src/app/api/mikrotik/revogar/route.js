// src/app/api/mikrotik/revogar/route.js
import { NextResponse } from "next/server";
import MikroNode from "mikronode-ng2";

export const runtime = "nodejs";

const ipv4 =
  /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
const ipv6 =
  /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(([0-9a-f]{1,4}:){1,7}:)|(([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4})|(([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2})|(([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3})|(([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4})|(([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5})|([0-9a-f]{1,4}:)((:[0-9a-f]{1,4}){1,6})|:((:[0-9a-f]{1,4}){1,7}|:))(%.+)?$/i;

function isValidIp(s) {
  return ipv4.test(s) || ipv6.test(s);
}

function sanitizeListName(s) {
  if (typeof s !== "string") return undefined;
  const ok = s.trim();
  return /^[A-Za-z0-9_-]{1,32}$/.test(ok) ? ok : undefined;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ip = (body?.ip || "").trim();
    const list = sanitizeListName(body?.list) || "paid_clients";

    if (!ip || !isValidIp(ip)) {
      return NextResponse.json({ ok: false, error: "IP inválido" }, { status: 400 });
    }

    const HOST = process.env.MIKROTIK_HOST;
    const PORT = Number(process.env.MIKROTIK_PORT || 28728);
    const USER = process.env.MIKROTIK_USER;
    const PASS = process.env.MIKROTIK_PASS;

    if (!HOST || !USER || !PASS) {
      return NextResponse.json(
        { ok: false, error: "Variáveis MIKROTIK_* ausentes" },
        { status: 400 }
      );
    }

    // --- Conecta via API RouterOS ---
    const conn = new MikroNode.Connection({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASS,
      timeout: 5000,
    });

    await conn.connect();
    const chan = conn.openChannel();

    // --- Executa remoção da lista ---
    const cmd = [
      `/ip/firewall/address-list/remove`,
      `=numbers=[find list=${list} address=${ip}]`,
    ];

    await chan.write(cmd);
    conn.close(true);

    console.log(`[MIKROTIK] IP ${ip} removido da lista ${list}`);

    return NextResponse.json({
      ok: true,
      ip,
      list,
      removed: true,
      message: `IP ${ip} removido da lista ${list}`,
    });
  } catch (e) {
    console.error("POST /api/mikrotik/revogar error:", e.message);
    const status = /timeout|ECONNREFUSED|EHOSTUNREACH/i.test(e.message)
      ? 502
      : 500;
    return NextResponse.json(
      { ok: false, error: e.message || "Falha ao revogar acesso" },
      { status }
    );
  }
}

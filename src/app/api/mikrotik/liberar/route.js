// src/app/api/mikrotik/liberar/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import MikroNode from "mikronode-ng2";

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

function sanitizeBusId(s) {
  if (typeof s !== "string") return undefined;
  const trimmed = s.trim().slice(0, 64);
  const safe = trimmed.replace(/[^A-Za-z0-9 _\-.:]/g, "");
  return safe.length ? safe : undefined;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ip = (body?.ip || "").trim();
    const busId = sanitizeBusId(body?.busId) || "sem_identificacao";
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

    // --- Conecta via Mikrotik API ---
    const conn = new MikroNode.Connection({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASS,
      timeout: 5000,
    });

    await conn.connect();
    const chan = conn.openChannel();

    // --- Adiciona IP à lista paid_clients ---
    const cmd = [
      "/ip/firewall/address-list/add",
      `=list=${list}`,
      `=address=${ip}`,
      `=comment=liberado_por_${busId}`,
    ];

    await chan.write(cmd);
    conn.close(true);

    console.log(`[MIKROTIK] IP ${ip} liberado para ${busId}`);

    return NextResponse.json({
      ok: true,
      ip,
      list,
      busId,
      created: true,
      message: `IP ${ip} liberado na lista ${list}`,
    });
  } catch (e) {
    console.error("POST /api/mikrotik/liberar error:", e.message);
    const status = /timeout|ECONNREFUSED|EHOSTUNREACH/i.test(e.message)
      ? 502
      : 500;
    return NextResponse.json(
      { ok: false, error: e.message || "Falha ao liberar acesso" },
      { status }
    );
  }
}

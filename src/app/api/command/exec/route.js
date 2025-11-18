// src/app/api/command/exec/route.js
// Implementação em JavaScript da rota /api/command/exec (sem TypeScript).

import { relayFetch } from "@/lib/relay";
import { requireDeviceRouter } from "@/lib/device-router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// CORS p/ chamadas diretas (ex.: teste via browser)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    },
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const command = String(body?.command || "").trim();

  if (!command) {
    return corsJson({ ok: false, error: "missing command" }, 400);
  }

  const asString = (value) => {
    if (typeof value === "string") return value;
    if (value == null) return null;
    return String(value);
  };
  const deviceInput = {
    deviceId: asString(body?.deviceId ?? body?.dispositivoId),
    mikId: asString(body?.mikId ?? body?.routerId),
  };

  let routerInfo;
  try {
    routerInfo = await requireDeviceRouter(deviceInput);
  } catch (err) {
    return corsJson(
      { ok: false, error: err?.code || "device_not_found", detail: err?.message },
      err?.code === "device_not_found" ? 404 : 400
    );
  }

  try {
    const r = await relayFetch("/relay/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" }, // Authorization vem do relayFetch
      body: JSON.stringify({
        host: routerInfo.router.host,
        user: routerInfo.router.user,
        pass: routerInfo.router.pass,
        port: routerInfo.router.port,
        command,
      }),
    });

    // Tenta JSON, se falhar, captura texto bruto
    const text = await r.text();
    let payload = text;
    try {
      payload = JSON.parse(text);
    } catch (_) {}

    return corsJson(payload, r.status);
  } catch (e) {
    // Timeout/Network/etc
    return corsJson({ ok: false, error: "relay_unreachable", detail: String(e?.message || e) }, 502);
  }
}

function corsJson(payload, status = 200) {
  return new Response(
    typeof payload === "string" ? payload : JSON.stringify(payload),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        Vary: "Origin",
      },
    }
  );
}

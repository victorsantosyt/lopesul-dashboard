// app/api/relay/exec/route.js
import { relayFetch } from "@/lib/relay";
import { requireDeviceRouter } from "@/lib/device-router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// CORS (preflight)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
      headers: { "Content-Type": "application/json" }, // importante
      body: JSON.stringify({
        host: routerInfo.router.host,
        user: routerInfo.router.user,
        pass: routerInfo.router.pass,
        port: routerInfo.router.port,
        command,
      }),
    });

    const j = await r.json().catch(() => ({}));
    return corsJson(j, r.status);
  } catch {
    return corsJson({ ok: false, error: "relay_unreachable" }, 502);
  }
}

function corsJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

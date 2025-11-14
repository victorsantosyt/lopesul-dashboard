// app/api/hotspot/kick/by-mac/route.js
import { relayFetch } from "@/lib/relay";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: cors(),
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mac = String(body?.mac || "").trim();

  // validação simples de MAC (relaxa em maiúsculas e separador)
  if (!mac || !/^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/.test(mac)) {
    return json({ ok: false, error: "invalid mac" }, 400);
  }

  try {
    const r = await relayFetch("/hotspot/kick/by-mac", {
      method: "POST",
      body: JSON.stringify({ mac }),
    });
    const j = await r.json().catch(() => ({}));
    return json(j, r.status);
  } catch {
    return json({ ok: false, error: "relay_unreachable" }, 502);
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: cors() });
}

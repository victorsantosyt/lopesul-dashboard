// src/app/api/command/exec/route.js
// Implementação em JavaScript da rota /api/command/exec (sem TypeScript).

import { relayFetch } from "@/lib/relay";

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

  // Lê somente do env do servidor (não expõe ao client)
  const env = (typeof globalThis !== "undefined" && globalThis.process && globalThis.process.env)
    ? globalThis.process.env
    : (typeof process !== "undefined" ? process.env || {} : {});
  const host = String(env.MIKROTIK_HOST || "");
  const user = String(env.MIKROTIK_USER || "");
  const pass = String(env.MIKROTIK_PASS || "");

  if (!host || !user || !pass) {
    return corsJson({ ok: false, error: "mikrotik env missing" }, 500);
  }

  try {
    const r = await relayFetch("/relay/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" }, // Authorization vem do relayFetch
      body: JSON.stringify({ host, user, pass, command }),
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

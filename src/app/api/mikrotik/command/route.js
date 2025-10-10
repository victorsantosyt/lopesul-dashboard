import { NextResponse } from "next/server";

const TIMEOUT = 5000;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { command } = body;

  if (!command) {
    return NextResponse.json({ success: false, error: "Comando não fornecido." });
  }

  const RELAY_URL = process.env.RELAY_URL;
  const MIKROTIK_HOST = process.env.MIKROTIK_HOST;
  const MIKROTIK_USER = process.env.MIKROTIK_USER;
  const MIKROTIK_PASS = process.env.MIKROTIK_PASS;

  if (!RELAY_URL || !MIKROTIK_HOST || !MIKROTIK_USER || !MIKROTIK_PASS) {
    return NextResponse.json({
      success: false,
      message: "Variáveis Mikrotik ausentes, mas backend ativo.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const response = await fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        host: MIKROTIK_HOST,
        user: MIKROTIK_USER,
        pass: MIKROTIK_PASS,
        command,
      }),
    });

    clearTimeout(timeout);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("❌ Relay respondeu com erro:", data);
      return NextResponse.json({
        success: false,
        error: data.error || "Falha ao executar comando via relay.",
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    clearTimeout(timeout);
    console.warn("⚠️ Relay Mikrotik inacessível:", err.message);
    return NextResponse.json({
      success: false,
      message: "Relay Mikrotik offline, backend continua operacional.",
    });
  }
}

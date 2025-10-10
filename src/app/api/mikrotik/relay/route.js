import { NextResponse } from "next/server";

const TIMEOUT = 4000; // 4 segundos

export async function GET() {
  const RELAY_URL = process.env.RELAY_URL;

  if (!RELAY_URL) {
    console.warn("⚠️ Variável RELAY_URL não configurada no ambiente.");
    return NextResponse.json({
      success: false,
      message: "Backend ativo, mas RELAY_URL ausente.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const response = await fetch(RELAY_URL, { method: "GET", signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      return NextResponse.json({ success: true, message: "Relay online e respondendo." });
    } else {
      console.warn(`⚠️ Relay respondeu com status ${response.status}`);
      return NextResponse.json({
        success: false,
        message: `Relay respondeu ${response.status}, mas backend OK.`,
      });
    }
  } catch (err) {
    clearTimeout(timeout);
    console.warn("⚠️ Relay inacessível:", err.message);
    return NextResponse.json({
      success: false,
      message: "Relay offline, mas backend ativo.",
    });
  }
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { command } = body;

  const RELAY_URL = process.env.RELAY_URL;
  const MIKROTIK_HOST = process.env.MIKROTIK_HOST;
  const MIKROTIK_USER = process.env.MIKROTIK_USER;
  const MIKROTIK_PASS = process.env.MIKROTIK_PASS;

  if (!RELAY_URL || !MIKROTIK_HOST || !MIKROTIK_USER || !MIKROTIK_PASS) {
    return NextResponse.json(
      { success: false, error: "Variáveis Mikrotik ausentes." },
      { status: 500 }
    );
  }

  if (!command) {
    return NextResponse.json(
      { success: false, error: "Nenhum comando Mikrotik fornecido." },
      { status: 400 }
    );
  }

  console.log(`📡 Enviando comando via Relay: ${command}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

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
      console.error("❌ Erro do Relay:", data);
      return NextResponse.json({
        success: false,
        error: data.error || "Falha ao executar comando no relay.",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Comando executado via relay.",
      data,
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error("⚠️ Relay inacessível:", err.message);
    return NextResponse.json({
      success: false,
      message: "Relay offline, backend OK.",
    });
  }
}

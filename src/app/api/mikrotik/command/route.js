// src/app/api/mikrotik/command/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { command } = body;

    if (!command) {
      return NextResponse.json(
        { success: false, error: "Comando Mikrotik não fornecido." },
        { status: 400 }
      );
    }

    // Carrega variáveis de ambiente obrigatórias
    const RELAY_URL = process.env.RELAY_URL;
    const MIKROTIK_HOST = process.env.MIKROTIK_HOST;
    const MIKROTIK_USER = process.env.MIKROTIK_USER;
    const MIKROTIK_PASS = process.env.MIKROTIK_PASS;

    // Valida as variáveis antes de tentar enviar
    if (!RELAY_URL || !MIKROTIK_HOST || !MIKROTIK_USER || !MIKROTIK_PASS) {
      console.warn("⚠️ Variáveis Mikrotik ausentes no ambiente.");
      return NextResponse.json(
        {
          success: false,
          error: "Variáveis Mikrotik ausentes. Verifique configuração no Railway.",
        },
        { status: 500 }
      );
    }

    console.log(`📡 Enviando comando Mikrotik: ${command}`);

    // Requisição protegida ao relay (com timeout manual)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 segundos de limite

    let response;
    try {
      response = await fetch(RELAY_URL, {
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
    } catch (err) {
      clearTimeout(timeout);
      console.warn("⚠️ Relay Mikrotik offline ou inacessível:", err.message);
      return NextResponse.json(
        { success: false, error: "Relay Mikrotik offline. Comando não enviado." },
        { status: 503 }
      );
    }
    clearTimeout(timeout);

    let data;
    try {
      data = await response.json();
    } catch {
      data = { error: "Resposta inválida do relay." };
    }

    if (!response.ok) {
      console.error("❌ Erro do relay:", data);
      return NextResponse.json(
        { success: false, error: data.error || "Falha ao executar comando." },
        { status: 500 }
      );
    }

    console.log("✅ Comando executado com sucesso no relay.");
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("💥 Erro geral na API Mikrotik:", err.message);
    return NextResponse.json(
      { success: false, error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

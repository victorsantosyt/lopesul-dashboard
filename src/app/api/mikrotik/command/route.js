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

    // IP da VPS no Tailscale (Relay Mikrotik)
    const RELAY_URL = process.env.RELAY_URL || "http://100.70.133.104:3001/mikrotik";

    // Dados de autenticação Mikrotik
    const MIKROTIK_HOST = process.env.MIKROTIK_HOST || "10.200.200.2";
    const MIKROTIK_USER = process.env.MIKROTIK_USER || "admin";
    const MIKROTIK_PASS = process.env.MIKROTIK_PASS || "admin";

    console.log(`📡 Enviando comando para relay: ${command}`);

    // Requisição ao relay na VPS
    const response = await fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: MIKROTIK_HOST,
        user: MIKROTIK_USER,
        pass: MIKROTIK_PASS,
        command,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Erro ao executar comando:", data);
      return NextResponse.json(
        { success: false, error: data.error || "Falha ao executar comando." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("💥 Erro geral na API Mikrotik:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

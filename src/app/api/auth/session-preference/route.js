// src/app/api/auth/session-preference/route.js
import { NextResponse } from "next/server";

const DUR_MAP = new Set(["30m", "1h", "4h", "8h", "24h", "permanent"]);

export async function GET(req) {
  const cookie = req.cookies.get("session_pref")?.value || null;
  return NextResponse.json({ preference: cookie });
}

export async function POST(req) {
  try {
    const { duration } = await req.json();
    if (!DUR_MAP.has(duration)) {
      return NextResponse.json({ error: "Duração inválida" }, { status: 400 });
    }

    // 180 dias para guardar a preferência
    const maxAge = 180 * 24 * 60 * 60;

    const res = NextResponse.json({ ok: true, saved: duration });
    res.cookies.set("session_pref", duration, {
      path: "/",
      sameSite: "lax",
      httpOnly: false, // pode ser lido no client (apenas preferência)
      secure: process.env.NODE_ENV === "production",
      maxAge,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: "Erro ao salvar preferência" }, { status: 500 });
  }
}

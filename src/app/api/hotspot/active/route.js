// app/api/hotspot/active/route.js
import { NextResponse } from "next/server";
import { relayFetch } from "@/lib/relay";

export async function GET() {
  try {
    const r = await relayFetch("/hotspot/active");
    const j = await r.json();
    return NextResponse.json(j, { status: r.status });
  } catch {
    return NextResponse.json({ ok: false, error: "relay_unreachable" }, { status: 502 });
  }
}

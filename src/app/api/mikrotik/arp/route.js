// src/app/api/mikrotik/arp/route.js
import { NextResponse } from "next/server";
import { relayFetch } from "@/lib/relay";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ip = searchParams.get("ip");

  if (!ip) {
    return NextResponse.json({ error: "IP required" }, { status: 400 });
  }

  const host = process.env.MIKROTIK_HOST || "";
  const user = process.env.MIKROTIK_USER || "";
  const pass = process.env.MIKROTIK_PASS || "";

  if (!host || !user || !pass) {
    return NextResponse.json({ error: "Mikrotik not configured" }, { status: 500 });
  }

  try {
    const r = await relayFetch("/relay/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host,
        user,
        pass,
        command: "/ip/arp/print",
      }),
    });

    if (!r.ok) {
      return NextResponse.json({ error: "Relay error" }, { status: 502 });
    }

    const j = await r.json();
    const arpList = Array.isArray(j?.data) ? j.data : [];

    // Busca entrada com o IP específico
    const entry = arpList.find((e) => e?.address === ip);

    if (entry && entry["mac-address"]) {
      return NextResponse.json({ mac: entry["mac-address"] });
    }

    return NextResponse.json({ mac: null, message: "MAC not found in ARP table" });
  } catch (e) {
    console.error("[ARP] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

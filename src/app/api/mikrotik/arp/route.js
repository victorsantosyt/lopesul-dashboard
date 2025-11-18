// src/app/api/mikrotik/arp/route.js
import { NextResponse } from "next/server";
import { relayFetch } from "@/lib/relay";
import { requireDeviceRouter } from "@/lib/device-router";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ip = searchParams.get("ip");
  const sanitizeId = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || /^\$\(.+\)$/.test(trimmed)) return null;
    return trimmed;
  };
  const deviceId = sanitizeId(searchParams.get("deviceId"));
  const mikId = sanitizeId(searchParams.get("mikId"));

  if (!ip) {
    return NextResponse.json({ error: "IP required" }, { status: 400 });
  }

  let routerInfo;
  try {
    routerInfo = await requireDeviceRouter({ deviceId, mikId });
  } catch (err) {
    return NextResponse.json(
      { error: err?.code || "device_not_found", detail: err?.message },
      err?.code === "device_not_found" ? 404 : 400
    );
  }

  try {
    const r = await relayFetch("/relay/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: routerInfo.router.host,
        user: routerInfo.router.user,
        pass: routerInfo.router.pass,
        port: routerInfo.router.port,
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

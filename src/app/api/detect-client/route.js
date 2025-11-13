// src/app/api/detect-client/route.js
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  
  // Tenta pegar o IP real do cliente (primeiro da cadeia x-forwarded-for)
  const ip = cfConnectingIp || realIp || forwarded?.split(",")[0]?.trim() || "unknown";

  const isLocal = 
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    (ip.startsWith("172.") && parseInt(ip.split(".")[1]) >= 16 && parseInt(ip.split(".")[1]) <= 31);

  return NextResponse.json({ ip, isLocal });
}

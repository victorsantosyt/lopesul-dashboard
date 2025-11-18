// src/app/api/detect-client/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

  // Tenta detectar dispositivo automaticamente pelo IP
  let deviceId = null;
  let mikId = null;
  
  if (ip && ip !== "unknown" && isLocal) {
    try {
      const device = await prisma.dispositivo.findFirst({
        where: { ip },
        select: { id: true, mikId: true },
      });
      
      if (device) {
        deviceId = device.id;
        mikId = device.mikId;
        console.log('[detect-client] Dispositivo encontrado pelo IP:', { ip, deviceId, mikId });
      }
    } catch (err) {
      console.error('[detect-client] Erro ao buscar dispositivo:', err);
      // Não falha se não conseguir buscar
    }
  }

  return NextResponse.json({ 
    ip, 
    isLocal,
    deviceId,
    mikId,
    deviceIdentifier: deviceId || mikId || null,
  });
}

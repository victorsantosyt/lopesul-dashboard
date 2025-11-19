// src/app/api/detect-client/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req) {
  // Tenta obter IP de várias fontes (ordem de prioridade)
  // IMPORTANTE: Mikrotik pode passar o IP do cliente em diferentes headers
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  const remoteAddr = req.headers.get("x-remote-addr") || 
                     req.headers.get("remote-addr") ||
                     null;
  // Headers específicos do Mikrotik
  const mikrotikIp = req.headers.get("x-mikrotik-ip") ||
                     req.headers.get("x-client-ip") ||
                     req.headers.get("x-original-ip") ||
                     null;
  
  // Tenta pegar o IP real do cliente (primeiro da cadeia x-forwarded-for)
  // Prioriza IPs locais se disponíveis
  let ip = mikrotikIp || realIp || cfConnectingIp || forwarded?.split(",")[0]?.trim() || remoteAddr || "unknown";
  
  // Se o IP não é local mas temos x-forwarded-for, tenta pegar o primeiro IP local da cadeia
  if (forwarded && !ip.startsWith("192.168.") && !ip.startsWith("10.") && !ip.startsWith("172.")) {
    const ips = forwarded.split(",").map(i => i.trim());
    const localIp = ips.find(i => 
      i.startsWith("192.168.") || 
      i.startsWith("10.") || 
      (i.startsWith("172.") && parseInt(i.split(".")[1]) >= 16 && parseInt(i.split(".")[1]) <= 31)
    );
    if (localIp) {
      ip = localIp;
      console.log('[detect-client] IP local encontrado na cadeia x-forwarded-for:', ip);
    }
  }
  
  // Se ainda for localhost/unknown, tenta pegar do socket (último recurso)
  if (ip === "unknown" || ip === "127.0.0.1" || ip === "::1") {
    // Log para debug
    console.log('[detect-client] Headers recebidos:', {
      'x-forwarded-for': forwarded,
      'x-real-ip': realIp,
      'cf-connecting-ip': cfConnectingIp,
      'x-remote-addr': remoteAddr,
    });
  }

  const isLocal = 
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    (ip.startsWith("172.") && parseInt(ip.split(".")[1]) >= 16 && parseInt(ip.split(".")[1]) <= 31);

  // Tenta detectar dispositivo automaticamente
  let deviceId = null;
  let mikId = null;
  
  // 1) Tenta pelo IP do cliente (se estiver cadastrado como dispositivo)
  if (ip && ip !== "unknown" && isLocal) {
    try {
      const device = await prisma.dispositivo.findFirst({
        where: { ip },
        select: { id: true, mikId: true },
      });
      
      if (device) {
        deviceId = device.id;
        mikId = device.mikId;
        console.log('[detect-client] Dispositivo encontrado pelo IP do cliente:', { ip, deviceId, mikId });
      }
    } catch (err) {
      console.error('[detect-client] Erro ao buscar dispositivo pelo IP:', err);
    }
  }
  
  // 2) Se não encontrou e está em rede local, busca todos os dispositivos e tenta encontrar pela subnet
  if (!deviceId && !mikId && isLocal && ip && ip !== "unknown" && ip !== "127.0.0.1") {
    try {
      const parts = ip.split(".");
      if (parts.length === 4) {
        const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
        
        // Busca todos os dispositivos e filtra pela subnet em JavaScript
        const allDevices = await prisma.dispositivo.findMany({
          select: { id: true, mikId: true, ip: true, mikrotikHost: true },
        });
        
        // Filtra dispositivos na mesma subnet
        const devicesInSubnet = allDevices.filter(d => {
          const deviceIp = String(d.ip || '').trim();
          const deviceHost = String(d.mikrotikHost || '').trim();
          return deviceIp.startsWith(subnet) || deviceHost.startsWith(subnet);
        });
        
        // Se encontrou apenas um dispositivo na subnet, usa ele
        if (devicesInSubnet.length === 1) {
          deviceId = devicesInSubnet[0].id;
          mikId = devicesInSubnet[0].mikId;
          console.log('[detect-client] Dispositivo encontrado pela subnet:', { subnet, ip, deviceId, mikId });
        } else if (devicesInSubnet.length > 1) {
          // Se encontrou múltiplos, prioriza o que tem mikrotikHost na mesma subnet
          const deviceByHost = devicesInSubnet.find(d => {
            const host = String(d.mikrotikHost || '').trim();
            return host && host.startsWith(subnet);
          });
          if (deviceByHost) {
            deviceId = deviceByHost.id;
            mikId = deviceByHost.mikId;
            console.log('[detect-client] Dispositivo escolhido entre múltiplos (por mikrotikHost):', { subnet, deviceId, mikId });
          } else {
            // Se não tem mikrotikHost, usa o primeiro
            deviceId = devicesInSubnet[0].id;
            mikId = devicesInSubnet[0].mikId;
            console.log('[detect-client] Dispositivo escolhido entre múltiplos (primeiro):', { subnet, deviceId, mikId });
          }
        }
      }
    } catch (err) {
      console.error('[detect-client] Erro ao buscar dispositivo pela subnet:', err);
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

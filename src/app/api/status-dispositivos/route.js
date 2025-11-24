// src/app/api/status-dispositivos/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { tcpCheck, pingCheck } from '@/lib/netcheck';
import { relayFetch } from '@/lib/relay';

const TIMEOUT_MS = 2500;

async function checkMikrotikStatus(roteador) {
  try {
    const port = roteador.portaApi || 8728;
    const online = await tcpCheck(roteador.ipLan, port, TIMEOUT_MS);
    
    let identity = null;
    if (online && roteador.usuario && roteador.senhaHash) {
      try {
        const r = await relayFetch('/relay/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: roteador.ipLan,
            user: roteador.usuario,
            pass: roteador.senhaHash,
            command: '/system/identity/print',
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (j?.ok && Array.isArray(j.data) && j.data[0]?.name) {
          identity = j.data[0].name;
        }
      } catch {}
    }
    
    return {
      online,
      ip: roteador.ipLan,
      nome: roteador.nome,
      identity: identity || roteador.nome,
    };
  } catch {
    return {
      online: false,
      ip: roteador.ipLan,
      nome: roteador.nome,
      identity: roteador.nome,
    };
  }
}

async function checkStarlinkStatus(dispositivo) {
  try {
    const ip = dispositivo.ip;
    if (!ip) return { online: false, ip: null, nome: dispositivo.mikId || 'N/A' };
    
    // Tenta TCP na porta 80 primeiro
    if (await tcpCheck(ip, 80, TIMEOUT_MS)) {
      return { online: true, ip, nome: dispositivo.mikId || ip, via: 'tcp:80' };
    }
    
    // Se falhar, tenta ping
    if (await pingCheck(ip, TIMEOUT_MS)) {
      return { online: true, ip, nome: dispositivo.mikId || ip, via: 'ping' };
    }
    
    return { online: false, ip, nome: dispositivo.mikId || ip };
  } catch {
    return { online: false, ip: dispositivo.ip, nome: dispositivo.mikId || 'N/A' };
  }
}

export async function GET() {
  try {
    // Buscar todos os roteadores (Mikrotiks)
    const roteadores = await prisma.roteador.findMany({
      select: {
        id: true,
        nome: true,
        ipLan: true,
        usuario: true,
        senhaHash: true,
        portaApi: true,
      },
    });

    // Buscar todos os dispositivos (Starlinks)
    const dispositivos = await prisma.dispositivo.findMany({
      select: {
        id: true,
        ip: true,
        mikId: true,
      },
    });

    // Verificar status de todos os Mikrotiks
    const mikrotiksStatus = await Promise.all(
      roteadores.map(r => checkMikrotikStatus(r))
    );

    // Verificar status de todos os Starlinks
    const starlinksStatus = await Promise.all(
      dispositivos.map(d => checkStarlinkStatus(d))
    );

    // Encontrar o primeiro online de cada tipo
    const mikrotikOnline = mikrotiksStatus.find(m => m.online);
    const starlinkOnline = starlinksStatus.find(s => s.online);

    return NextResponse.json({
      mikrotik: {
        online: !!mikrotikOnline,
        nome: mikrotikOnline?.nome || null,
        identity: mikrotikOnline?.identity || null,
        ip: mikrotikOnline?.ip || null,
        total: mikrotiksStatus.length,
        todos: mikrotiksStatus,
      },
      starlink: {
        online: !!starlinkOnline,
        nome: starlinkOnline?.nome || null,
        ip: starlinkOnline?.ip || null,
        via: starlinkOnline?.via || null,
        total: starlinksStatus.length,
        todos: starlinksStatus,
      },
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('GET /api/status-dispositivos:', e?.message || e);
    return NextResponse.json({
      mikrotik: { online: false, nome: null, identity: null, ip: null, total: 0, todos: [] },
      starlink: { online: false, nome: null, ip: null, via: null, total: 0, todos: [] },
      error: String(e?.message || e),
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}


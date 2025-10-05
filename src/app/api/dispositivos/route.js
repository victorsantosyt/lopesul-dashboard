// src/app/api/dispositivos/status/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAnyOnline, checkStarlink } from '@/lib/netcheck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickIp(row) {
  return row?.ip ?? row?.enderecoIp ?? row?.ipAddress ?? row?.host ?? null;
}

export async function GET() {
  try {
    const dispositivos = await prisma.dispositivo.findMany({ take: 1000 });
    const ipsDb = Array.from(new Set((dispositivos ?? []).map(pickIp).filter(Boolean)));

    if (process.env.MIKROTIK_HOST) ipsDb.push(process.env.MIKROTIK_HOST);
    if (process.env.STARLINK_HOST) ipsDb.push(process.env.STARLINK_HOST);

    const mk = await checkAnyOnline(ipsDb);
    const sl = await checkStarlink(ipsDb);

    return NextResponse.json(
      {
        mikrotik: {
          online: mk.online,
          hosts: ipsDb,
          lastHost: mk.lastHost,
          port: Number(process.env.MIKROTIK_PORT || 8728),
          via: process.env.MIKROTIK_VIA_VPS === '1' ? 'vps:ssh' : 'direct',
        },
        starlink: {
          online: sl.online,
          hosts: ipsDb,
          lastHost: sl.lastHost,
          via: process.env.STARLINK_VIA_VPS === '1' ? 'vps:ssh' : 'direct',
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('GET /api/dispositivos/status', e?.message || e);
    return NextResponse.json(
      { mikrotik: { online: false }, starlink: { online: false } },
      { status: 200 }
    );
  }
}

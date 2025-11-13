// src/app/api/frotas/[id]/status/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    // Buscar frota
    const frota = await prisma.frota.findUnique({
      where: { id },
      include: {
        dispositivos: true
      }
    });

    if (!frota) {
      return NextResponse.json(
        { error: 'Frota não encontrada' },
        { status: 404 }
      );
    }

    // Status simulado baseado em dispositivos
    const status = {
      online: frota.dispositivos.length > 0,
      dispositivos: frota.dispositivos.length,
      ultimaAtualizacao: new Date().toISOString()
    };

    return NextResponse.json(status, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('GET /api/frotas/[id]/status', error);
    return NextResponse.json(
      { error: 'Erro ao buscar status', online: false },
      { status: 500 }
    );
  }
}

// src/app/api/roteadores/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

// Lista roteadores (sem expor senhaHash)
export async function GET() {
  try {
    const roteadores = await prisma.roteador.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nome: true,
        ipLan: true,
        usuario: true,
        portaApi: true,
        portaSsh: true,
        wgPublicKey: true,
        wgIp: true,
        statusMikrotik: true,
        statusWireguard: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(roteadores, { status: 200 });
  } catch (err) {
    console.error('GET /api/roteadores =>', err);
    return NextResponse.json({ error: 'Erro ao listar roteadores.' }, { status: 500 });
  }
}

// Cria um novo roteador
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      nome,
      ipLan,
      usuario,
      senha,
      portaApi,
      portaSsh,
      wgPublicKey,
      wgIp,
    } = body || {};

    if (!nome?.trim() || !ipLan?.trim() || !usuario?.trim() || !senha?.trim()) {
      return NextResponse.json(
        { error: 'Nome, IP, usuário e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    const senhaHash = await bcrypt.hash(String(senha).trim(), 10);

    const created = await prisma.roteador.create({
      data: {
        nome: String(nome).trim(),
        ipLan: String(ipLan).trim(),
        usuario: String(usuario).trim(),
        senhaHash,
        portaApi: portaApi ? Number(portaApi) : undefined,
        portaSsh: portaSsh ? Number(portaSsh) : undefined,
        wgPublicKey: wgPublicKey ? String(wgPublicKey).trim() : null,
        wgIp: wgIp ? String(wgIp).trim() : null,
      },
      select: {
        id: true,
        nome: true,
        ipLan: true,
        usuario: true,
        portaApi: true,
        portaSsh: true,
        wgPublicKey: true,
        wgIp: true,
        statusMikrotik: true,
        statusWireguard: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/roteadores =>', err);
    return NextResponse.json({ error: 'Erro ao criar roteador.' }, { status: 500 });
  }
}

// src/app/api/roteadores/[id]/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

function json(payload, status = 200) {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(_req, { params }) {
  try {
    const id = String(params?.id || '').trim();
    if (!id) return json({ error: 'ID inválido' }, 400);

    const roteador = await prisma.roteador.findUnique({
      where: { id },
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

    if (!roteador) return json({ error: 'Roteador não encontrado' }, 404);
    return json(roteador, 200);
  } catch (err) {
    console.error('GET /api/roteadores/[id] =>', err);
    return json({ error: 'Erro ao buscar roteador' }, 500);
  }
}

export async function PUT(req, { params }) {
  try {
    const id = String(params?.id || '').trim();
    if (!id) return json({ error: 'ID inválido' }, 400);

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
      statusMikrotik,
      statusWireguard,
    } = body || {};

    const data = {};
    if (nome != null) data.nome = String(nome).trim();
    if (ipLan != null) data.ipLan = String(ipLan).trim();
    if (usuario != null) data.usuario = String(usuario).trim();
    if (portaApi != null) data.portaApi = Number(portaApi);
    if (portaSsh != null) data.portaSsh = Number(portaSsh);
    if (wgPublicKey !== undefined) data.wgPublicKey = wgPublicKey ? String(wgPublicKey).trim() : null;
    if (wgIp !== undefined) data.wgIp = wgIp ? String(wgIp).trim() : null;
    if (statusMikrotik !== undefined) data.statusMikrotik = statusMikrotik;
    if (statusWireguard !== undefined) data.statusWireguard = statusWireguard;

    if (senha != null && String(senha).trim()) {
      data.senhaHash = await bcrypt.hash(String(senha).trim(), 10);
    }

    const updated = await prisma.roteador.update({
      where: { id },
      data,
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

    return json(updated, 200);
  } catch (err) {
    console.error('PUT /api/roteadores/[id] =>', err);
    return json({ error: 'Erro ao atualizar roteador' }, 500);
  }
}

export async function DELETE(_req, { params }) {
  try {
    const id = String(params?.id || '').trim();
    if (!id) return json({ error: 'ID inválido' }, 400);

    await prisma.roteador.delete({ where: { id } });
    return json({ ok: true, id }, 200);
  } catch (err) {
    console.error('DELETE /api/roteadores/[id] =>', err);
    return json({ error: 'Erro ao remover roteador' }, 500);
  }
}

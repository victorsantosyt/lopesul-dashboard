// src/app/api/dispositivos/[id]/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Helper com CORS
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function DELETE(_req, { params }) {
  try {
    const id = String(params?.id || '').trim();
    if (!id) return json({ error: 'ID inválido' }, 400);

    // Se seu schema usa número, e você QUISER aceitar numérico também:
    // const where = /^\d+$/.test(id) ? { id: Number(id) } : { id };

    // Como não sabemos o tipo do id, tratamos como string (UUID/Texto)
    const where = { id };

    const deleted = await prisma.dispositivo.delete({ where });

    return json({
      ok: true,
      message: 'Dispositivo removido com sucesso.',
      id: deleted.id,
    });
  } catch (err) {
    // Prisma: registro não encontrado
    if (err?.code === 'P2025') {
      return json({ error: 'Dispositivo não encontrado.' }, 404);
    }
    console.error('[DELETE /api/dispositivos/:id] erro:', err);
    return json({ error: 'Erro ao remover dispositivo.' }, 500);
  }
}

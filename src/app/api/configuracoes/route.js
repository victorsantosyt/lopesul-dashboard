// src/app/api/configuracoes/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const K_SESSION = 'sessionDefault';     // em segundos
const K_MAINT   = 'maintenance';        // 'true' | 'false'

// ajuda
async function getCfg(key, fallback) {
  const row = await prisma.config.findUnique({ where: { key }});
  if (!row) return fallback;
  return row.value;
}
async function setCfg(key, val) {
  return prisma.config.upsert({
    where: { key },
    update: { value: String(val) },
    create: { key, value: String(val) },
  });
}

// GET: { maintenance: boolean, sessionDefault: number }
export async function GET() {
  const sessionDefault = Number(await getCfg(K_SESSION, 60 * 60 * 4)) || (60 * 60 * 4);
  const maintenance = String(await getCfg(K_MAINT, 'false')) === 'true';
  return NextResponse.json({ sessionDefault, maintenance });
}

// PUT: admin-only
export async function PUT(req) {
  try {
    // simples: admin = cookie 'is_admin' === '1'
    const isAdmin = req.cookies.get('is_admin')?.value === '1';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Apenas admin' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const out = {};

    if (typeof body.sessionDefault === 'number' && body.sessionDefault > 0) {
      await setCfg(K_SESSION, body.sessionDefault);
      out.sessionDefault = body.sessionDefault;
    }
    if (typeof body.maintenance === 'boolean') {
      await setCfg(K_MAINT, body.maintenance ? 'true' : 'false');
      out.maintenance = body.maintenance;
    }

    if (!Object.keys(out).length) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    return NextResponse.json(out);
  } catch (e) {
    console.error('PUT /api/configuracoes', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// CORS preflight se precisar
export function OPTIONS() {
  return NextResponse.json({}, { status: 204 });
}

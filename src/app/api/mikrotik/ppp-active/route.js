// src/app/api/mikrotik/ppp-active/route.js
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { listPppActive } from '@/lib/mikrotik';

export async function GET() {
  try {
    const rows = await listPppActive();
    return NextResponse.json({ ok: true, rows }, { status: 200 });
  } catch (e) {
    console.error('mikrotik error:', e);
    // Não quebre o dashboard: responda 200 com ok:false
    return NextResponse.json({ ok: false, rows: [], error: e.message }, { status: 200 });
  }
}

import { NextResponse } from 'next/server';
import { revogarAcesso } from '@/lib/mikrotik';

export async function POST(req) {
  try {
    const { ip } = await req.json();
    const r = await revogarAcesso({ ip });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

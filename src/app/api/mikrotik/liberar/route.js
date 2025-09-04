import { NextResponse } from 'next/server';
import { liberarAcesso } from '@/lib/mikrotik';

export async function POST(req) {
  try {
    const { ip, busId } = await req.json();
    const r = await liberarAcesso({ ip, busId });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

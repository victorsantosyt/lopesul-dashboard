// app/api/hotspot/kick/route.ts
import { NextResponse } from 'next/server';
import { relayFetch } from '@/lib/relay';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const r = await relayFetch('/hotspot/kick', {
      method: 'POST',
      body: JSON.stringify({ id: body?.id }),
    });
    const j = await r.json();
    return NextResponse.json(j, { status: r.status });
  } catch {
    return NextResponse.json({ ok:false, error:'relay_unreachable' }, { status: 502 });
  }
}

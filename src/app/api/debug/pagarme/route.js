// src/app/api/_debug/pagarme/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pagarmeGET, __pagarmeBase, __pagarmeDebugMask } from '@/lib/pagarme';

export async function GET() {
  try {
    const base = __pagarmeBase;
    const keyMasked = __pagarmeDebugMask();

    let ping = null;
    try {
      // Consulta mínima só pra validar permissão/ambiente
      const data = await pagarmeGET('/orders?page=1&size=1');
      const sampleLen = Array.isArray(data?.data) ? data.data.length : null;
      ping = { ok: true, status: 200, sample: sampleLen };
    } catch (e) {
      // Log full error with stack trace server-side for diagnostics
      console.error("pagarmeGET error:", e);
      ping = {
        ok: false,
        status: e?.status || 0,
        data: e?.message || "Internal error",
      };
    }

    const json = {
      base,
      key_present: keyMasked !== '(vazio)',
      key_masked: keyMasked, // ex.: "sk_e...3eac"
      ping,
      // opcional: mostre em qual NODE_ENV está rodando
      env: process.env.NODE_ENV || 'development',
      // opcional: app url pra você confirmar de onde o webhook deveria apontar
      app_url: process.env.APP_URL || null,
    };

    return new NextResponse(JSON.stringify(json), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store, no-cache, must-revalidate',
        pragma: 'no-cache',
        expires: '0',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

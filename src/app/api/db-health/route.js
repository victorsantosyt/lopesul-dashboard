// src/app/api/_db-health/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*', // útil p/ checar de qualquer lugar
    },
  });
}

export async function GET() {
  const t0 = Date.now();
  try {
    // Uma ida só ao banco: timestamp + timezone do server
    // (AT TIME ZONE 'UTC' ajuda a comparar relógios app x db)
    const rows = await prisma.$queryRaw`
      SELECT
        NOW()                               AS now_db,
        NOW() AT TIME ZONE 'UTC'            AS now_utc,
        current_setting('TimeZone', true)   AS db_timezone
    `;
    const ms = Date.now() - t0;

    const row = Array.isArray(rows) && rows[0] ? rows[0] : {};
    return json({
      ok: true,
      db: 'connected',
      latency_ms: ms,
      now_db: row.now_db ?? null,
      now_utc: row.now_utc ?? null,
      db_timezone: row.db_timezone ?? null,
    });
  } catch (e) {
    const ms = Date.now() - t0;
    return json(
      {
        ok: false,
        db: 'error',
        latency_ms: ms,
        error: String(e?.message || e),
      },
      500
    );
  }
}

// (Opcional) CORS preflight, caso rode health de um browser
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store',
    },
  });
}

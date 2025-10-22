// src/app/api/_db-health/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const rows = await prisma.$queryRawUnsafe("SELECT NOW() as now");
    const now = Array.isArray(rows) && rows[0]?.now ? rows[0].now : null;
    return NextResponse.json({ ok: true, db: "connected", now });
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: "error", error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

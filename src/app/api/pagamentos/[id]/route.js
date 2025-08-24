// src/app/api/pagamentos/[id]/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";        // Prisma = Node
export const dynamic = "force-dynamic"; // sem cache

// Em dev/Next 15, params pode ser uma Promise; resolvemos seguro aqui
async function getId(context) {
  try {
    const p = context?.params;
    const resolved = p && typeof p.then === "function" ? await p : p;
    return resolved?.id || null;
  } catch {
    return null;
  }
}

/* GET /api/pagamentos/:id  -> { id, status, pagamento } */
export async function GET(_req, context) {
  try {
    const id = await getId(context);
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const pagamento = await prisma.pagamento.findUnique({ where: { id } });
    if (!pagamento) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

    return NextResponse.json({
      id: pagamento.id,
      status: (pagamento.status || "pendente").toLowerCase(),
      pagamento,
    });
  } catch (e) {
    console.error("GET /api/pagamentos/[id]", e);
    return NextResponse.json({ error: "erro ao buscar pagamento" }, { status: 500 });
  }
}

/* PATCH /api/pagamentos/:id  (atualiza payload/status/etc) */
export async function PATCH(req, context) {
  try {
    const id = await getId(context);
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const data = {};

    if (typeof body.payload === "string") data.payload = body.payload;
    if (typeof body.chavePix === "string") data.chavePix = body.chavePix;
    if (typeof body.descricao === "string") data.descricao = body.descricao;
    if (typeof body.plano === "string") data.plano = body.plano;
    if (Number.isFinite(Number(body.valor))) data.valor = Number(body.valor);

    if (body.status) {
      const s = String(body.status).toLowerCase();
      if (["pago", "pendente", "expirado", "cancelado"].includes(s)) data.status = s;
    }
    if (body.pagoEm) data.pagoEm = new Date(body.pagoEm);
    if (body.expiraEm) data.expiraEm = new Date(body.expiraEm);

    // opcionais de rede
    if (typeof body.ip === "string") data.ip = body.ip;
    if (typeof body.mac === "string") data.mac = body.mac;
    if (typeof body.roteador === "string") data.roteador = body.roteador;

    const updated = await prisma.pagamento.update({ where: { id }, data });

    return NextResponse.json({
      id: updated.id,
      status: (updated.status || "pendente").toLowerCase(),
      pagamento: updated,
    });
  } catch (e) {
    console.error("PATCH /api/pagamentos/[id]", e);
    return NextResponse.json({ error: "erro ao atualizar pagamento" }, { status: 500 });
  }
}

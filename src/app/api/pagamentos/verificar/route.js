import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function POST(request) {
  try {
    const { pedido_id } = await request.json()

    if (!pedido_id) {
      return NextResponse.json({ error: "pedido_id é obrigatório" }, { status: 400 })
    }

    // Buscar pedido com charges
    const pedido = await prisma.pedido.findUnique({
      where: { id: pedido_id },
      include: {
        charges: {
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    const ultimaCharge = pedido.charges[0]

    return NextResponse.json({
      pedido_id: pedido.id,
      status: pedido.status,
      valor: pedido.valor,
      mac_address: pedido.mac_address,
      ip_address: pedido.ip_address,
      charge: ultimaCharge
        ? {
            id: ultimaCharge.charge_id,
            status: ultimaCharge.status,
            qr_code: ultimaCharge.qr_code,
            qr_code_url: ultimaCharge.qr_code_url,
            expires_at: ultimaCharge.expires_at,
          }
        : null,
      created_at: pedido.created_at,
      updated_at: pedido.updated_at,
    })
  } catch (error) {
    console.error("[v0] Erro ao verificar pagamento:", error)
    return NextResponse.json({ error: "Erro ao verificar pagamento", details: error.message }, { status: 500 })
  }
}

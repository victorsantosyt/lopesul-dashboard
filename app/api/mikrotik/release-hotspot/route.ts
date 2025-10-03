import { type NextRequest, NextResponse } from "next/server"
import { hotspotManager } from "@/lib/hotspot-manager"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentId, macAddress } = body

    if (!paymentId || !macAddress) {
      return NextResponse.json({ error: "paymentId e macAddress são obrigatórios" }, { status: 400 })
    }

    // Liberar acesso ao hotspot
    const success = await hotspotManager.releaseHotspotAccess(paymentId, macAddress)

    if (success) {
      return NextResponse.json({ success: true, message: "Hotspot liberado com sucesso" })
    } else {
      return NextResponse.json({ error: "Falha ao liberar hotspot" }, { status: 500 })
    }
  } catch (error) {
    console.error("Erro na API de liberação de hotspot:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

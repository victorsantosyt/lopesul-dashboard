import { type NextRequest, NextResponse } from "next/server"
import { hotspotManager } from "@/lib/hotspot-manager"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId é obrigatório" }, { status: 400 })
    }

    // Desconectar usuário
    const success = await hotspotManager.disconnectHotspotUser(sessionId)

    if (success) {
      return NextResponse.json({ success: true, message: "Usuário desconectado com sucesso" })
    } else {
      return NextResponse.json({ error: "Falha ao desconectar usuário" }, { status: 500 })
    }
  } catch (error) {
    console.error("Erro na API de desconexão:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

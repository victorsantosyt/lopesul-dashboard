import { type NextRequest, NextResponse } from "next/server"
import { hotspotManager } from "@/lib/hotspot-manager"

export async function POST(request: NextRequest) {
  try {
    // Expirar sessões antigas
    const expiredCount = await hotspotManager.expireOldSessions()

    return NextResponse.json({
      success: true,
      message: `${expiredCount} sessões expiradas foram desconectadas`,
      expired_count: expiredCount,
    })
  } catch (error) {
    console.error("Erro na API de expiração de sessões:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

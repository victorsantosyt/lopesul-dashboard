import { type NextRequest, NextResponse } from "next/server"
import { hotspotManager } from "@/lib/hotspot-manager"

// Esta API pode ser chamada por um cron job para expirar sessões automaticamente
export async function POST(request: NextRequest) {
  try {
    // Verificar se a requisição vem de um cron job autorizado
    const authHeader = request.headers.get("authorization")
    const expectedAuth = `Bearer ${process.env.CRON_SECRET || "default-secret"}`

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Expirar sessões antigas
    const expiredCount = await hotspotManager.expireOldSessions()

    return NextResponse.json({
      success: true,
      message: `Cron job executado: ${expiredCount} sessões expiradas`,
      expired_count: expiredCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Erro no cron job:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// Permitir GET também para testes manuais
export async function GET(request: NextRequest) {
  return POST(request)
}

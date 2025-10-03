import { type NextRequest, NextResponse } from "next/server"
import { automationService } from "@/lib/automation-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case "process-pending":
        const processedCount = await automationService.processePendingHotspotReleases()
        return NextResponse.json({
          success: true,
          message: `${processedCount} pagamentos processados`,
          processed_count: processedCount,
        })

      case "health-check":
        const healthReport = await automationService.monitorSystemHealth()
        return NextResponse.json({
          success: true,
          health_report: healthReport,
        })

      default:
        return NextResponse.json({ error: "Ação não reconhecida" }, { status: 400 })
    }
  } catch (error) {
    console.error("Erro na API de automação:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

import { createClient } from "@/lib/supabase/server"
import { hotspotManager } from "@/lib/hotspot-manager"

export class AutomationService {
  private supabase

  constructor() {
    this.supabase = null
  }

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  // Processar pagamentos confirmados que ainda não liberaram hotspot
  async processePendingHotspotReleases(): Promise<number> {
    try {
      const supabase = await this.getSupabase()

      // Buscar pagamentos pagos que não têm sessão de hotspot ativa
      const { data: paidPayments, error } = await supabase
        .from("payments")
        .select(`
          *,
          hotspot_sessions!left (id)
        `)
        .eq("status", "paid")
        .is("hotspot_sessions.id", null) // Pagamentos sem sessão de hotspot

      if (error || !paidPayments) {
        console.error("Erro ao buscar pagamentos pendentes:", error)
        return 0
      }

      let processedCount = 0

      for (const payment of paidPayments) {
        try {
          // Buscar MAC address dos logs do checkout
          const { data: checkoutLog } = await supabase
            .from("system_logs")
            .select("data")
            .eq("payment_id", payment.id)
            .eq("type", "payment")
            .like("message", "%Checkout criado%")
            .single()

          if (checkoutLog?.data?.mac_address) {
            const macAddress = checkoutLog.data.mac_address

            // Tentar liberar hotspot
            const success = await hotspotManager.releaseHotspotAccess(payment.id, macAddress)

            if (success) {
              processedCount++
              console.log(`[v0] Hotspot liberado automaticamente para pagamento ${payment.id}`)
            }
          }
        } catch (error) {
          console.error(`Erro ao processar pagamento ${payment.id}:`, error)

          // Log do erro
          await supabase.from("system_logs").insert({
            type: "error",
            message: `Erro no processamento automático: ${error}`,
            data: {
              payment_id: payment.id,
              error: error.toString(),
            },
            payment_id: payment.id,
          })
        }
      }

      return processedCount
    } catch (error) {
      console.error("Erro no processamento automático:", error)
      return 0
    }
  }

  // Monitorar e alertar sobre problemas no sistema
  async monitorSystemHealth(): Promise<any> {
    try {
      const supabase = await this.getSupabase()

      // Verificar pagamentos pendentes há mais de 2 horas
      const twoHoursAgo = new Date()
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)

      const { data: oldPendingPayments } = await supabase
        .from("payments")
        .select("count")
        .eq("status", "pending")
        .lt("created_at", twoHoursAgo.toISOString())

      // Verificar sessões ativas que deveriam ter expirado
      const now = new Date().toISOString()
      const { data: expiredActiveSessions } = await supabase
        .from("hotspot_sessions")
        .select("count")
        .eq("status", "active")
        .lt("expires_at", now)

      // Verificar erros recentes (última hora)
      const oneHourAgo = new Date()
      oneHourAgo.setHours(oneHourAgo.getHours() - 1)

      const { data: recentErrors } = await supabase
        .from("system_logs")
        .select("count")
        .eq("type", "error")
        .gte("created_at", oneHourAgo.toISOString())

      const healthReport = {
        timestamp: new Date().toISOString(),
        old_pending_payments: oldPendingPayments?.[0]?.count || 0,
        expired_active_sessions: expiredActiveSessions?.[0]?.count || 0,
        recent_errors: recentErrors?.[0]?.count || 0,
        status: "healthy",
      }

      // Determinar status geral
      if (healthReport.recent_errors > 10 || healthReport.expired_active_sessions > 5) {
        healthReport.status = "warning"
      }
      if (healthReport.recent_errors > 50 || healthReport.old_pending_payments > 10) {
        healthReport.status = "critical"
      }

      // Log do relatório de saúde
      await supabase.from("system_logs").insert({
        type: "system",
        message: `Relatório de saúde do sistema: ${healthReport.status}`,
        data: healthReport,
      })

      return healthReport
    } catch (error) {
      console.error("Erro no monitoramento do sistema:", error)
      return {
        timestamp: new Date().toISOString(),
        status: "error",
        error: error.toString(),
      }
    }
  }
}

// Instância singleton do serviço de automação
export const automationService = new AutomationService()

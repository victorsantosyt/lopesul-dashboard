import { createClient } from "@/lib/supabase/server"
import {
  mikrotikAPI,
  generateHotspotUsername,
  generateHotspotPassword,
  formatDurationForMikrotik,
} from "@/lib/mikrotik"

export class HotspotManager {
  private supabase

  constructor() {
    this.supabase = null // Será inicializado quando necessário
  }

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  // Liberar acesso ao hotspot após pagamento confirmado
  async releaseHotspotAccess(paymentId: string, macAddress: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase()

      // Buscar dados do pagamento e plano
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .select(`
          *,
          plans (
            name,
            duration_hours,
            speed_download,
            speed_upload
          )
        `)
        .eq("id", paymentId)
        .eq("status", "paid")
        .single()

      if (paymentError || !payment) {
        throw new Error("Pagamento não encontrado ou não confirmado")
      }

      // Gerar credenciais do hotspot
      const username = generateHotspotUsername(paymentId)
      const password = generateHotspotPassword()
      const duration = formatDurationForMikrotik(payment.plans.duration_hours)

      // Calcular quando a sessão expira
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + payment.plans.duration_hours)

      // Adicionar usuário ao hotspot do Mikrotik
      const mikrotikUserId = await mikrotikAPI.addHotspotUser({
        name: username,
        password: password,
        profile: "default", // Pode ser configurado baseado no plano
        comment: `Payment: ${paymentId} | Customer: ${payment.customer_name}`,
        "limit-uptime": duration,
      })

      // Adicionar MAC à lista de permitidos (opcional, dependendo da configuração)
      const allowedListId = await mikrotikAPI.addToAllowedList(
        macAddress,
        `Hotspot user: ${username} | Expires: ${expiresAt.toISOString()}`,
      )

      // Salvar sessão no banco de dados
      const { data: session, error: sessionError } = await supabase
        .from("hotspot_sessions")
        .insert({
          payment_id: paymentId,
          mac_address: macAddress,
          mikrotik_session_id: mikrotikUserId,
          status: "active",
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (sessionError) {
        // Se falhar ao salvar no banco, tentar limpar do Mikrotik
        try {
          await mikrotikAPI.removeHotspotUser(mikrotikUserId)
          await mikrotikAPI.removeFromAllowedList(allowedListId)
        } catch (cleanupError) {
          console.error("Erro ao limpar Mikrotik após falha:", cleanupError)
        }
        throw new Error("Erro ao salvar sessão no banco de dados")
      }

      // Log da liberação
      await supabase.from("system_logs").insert({
        type: "mikrotik",
        message: `Hotspot liberado para MAC ${macAddress}`,
        data: {
          payment_id: paymentId,
          session_id: session.id,
          username: username,
          duration_hours: payment.plans.duration_hours,
          expires_at: expiresAt.toISOString(),
        },
        payment_id: paymentId,
        session_id: session.id,
      })

      console.log(`[v0] Hotspot liberado: ${username} para MAC ${macAddress}`)
      return true
    } catch (error) {
      console.error("Erro ao liberar hotspot:", error)

      // Log do erro
      const supabase = await this.getSupabase()
      await supabase.from("system_logs").insert({
        type: "error",
        message: `Erro ao liberar hotspot: ${error}`,
        data: {
          payment_id: paymentId,
          mac_address: macAddress,
          error: error.toString(),
        },
        payment_id: paymentId,
      })

      return false
    }
  }

  // Desconectar usuário (quando sessão expira ou é cancelada)
  async disconnectHotspotUser(sessionId: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase()

      // Buscar sessão
      const { data: session, error: sessionError } = await supabase
        .from("hotspot_sessions")
        .select("*")
        .eq("id", sessionId)
        .single()

      if (sessionError || !session) {
        throw new Error("Sessão não encontrada")
      }

      // Desconectar do Mikrotik
      await mikrotikAPI.disconnectActiveUser(session.mac_address)

      // Remover usuário do hotspot
      if (session.mikrotik_session_id) {
        await mikrotikAPI.removeHotspotUser(session.mikrotik_session_id)
      }

      // Atualizar status da sessão
      await supabase
        .from("hotspot_sessions")
        .update({
          status: "disconnected",
          disconnected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)

      // Log da desconexão
      await supabase.from("system_logs").insert({
        type: "mikrotik",
        message: `Usuário desconectado: MAC ${session.mac_address}`,
        data: {
          session_id: sessionId,
          mac_address: session.mac_address,
        },
        session_id: sessionId,
      })

      console.log(`[v0] Usuário desconectado: ${session.mac_address}`)
      return true
    } catch (error) {
      console.error("Erro ao desconectar usuário:", error)
      return false
    }
  }

  // Verificar e expirar sessões vencidas
  async expireOldSessions(): Promise<number> {
    try {
      const supabase = await this.getSupabase()
      const now = new Date().toISOString()

      // Buscar sessões expiradas
      const { data: expiredSessions, error } = await supabase
        .from("hotspot_sessions")
        .select("*")
        .eq("status", "active")
        .lt("expires_at", now)

      if (error || !expiredSessions) {
        return 0
      }

      let expiredCount = 0

      // Desconectar cada sessão expirada
      for (const session of expiredSessions) {
        const success = await this.disconnectHotspotUser(session.id)
        if (success) {
          expiredCount++
        }
      }

      console.log(`[v0] ${expiredCount} sessões expiradas foram desconectadas`)
      return expiredCount
    } catch (error) {
      console.error("Erro ao expirar sessões:", error)
      return 0
    }
  }
}

// Instância singleton do gerenciador de hotspot
export const hotspotManager = new HotspotManager()

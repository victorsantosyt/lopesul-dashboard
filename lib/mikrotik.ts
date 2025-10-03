// lib/mikrotik.ts
import { RouterOSClient } from "routeros-client"

const MIKROTIK_CONFIG = {
  host: process.env.MIKROTIK_HOST || process.env.MIKOTIK_HOST || "192.168.88.1",
  port: Number.parseInt(process.env.MIKROTIK_PORT || "8728", 10),
  user: process.env.MIKROTIK_USERNAME || "admin",
  password: process.env.MIKROTIK_PASSWORD || "",
  timeout: 10000,
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates
  },
}

interface LiberarAcessoParams {
  ip: string
  busId?: string
  list?: string
}

interface LiberarAcessoResult {
  ok: boolean
  list: string
  ip: string
  id?: string
  created: boolean
  error?: string
}

export function generateHotspotUsername(paymentId: string): string {
  return `user-${paymentId.substring(0, 8)}-${Date.now()}`
}

export function generateHotspotPassword(): string {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
}

export function formatDurationForMikrotik(hours: number): string {
  const totalSeconds = hours * 3600
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

export class MikrotikAPI {
  private async getClient(): Promise<RouterOSClient> {
    const api = new RouterOSClient({
      host: MIKROTIK_CONFIG.host,
      port: MIKROTIK_CONFIG.port,
      user: MIKROTIK_CONFIG.user,
      password: MIKROTIK_CONFIG.password,
      timeout: MIKROTIK_CONFIG.timeout,
      tls: MIKROTIK_CONFIG.tls,
    })
    await api.connect()
    return api
  }

  async addHotspotUser(params: {
    name: string
    password: string
    profile: string
    comment: string
    "limit-uptime": string
  }): Promise<string> {
    const api = await this.getClient()
    try {
      const result = await api.menu("/ip/hotspot/user").add(params)
      await api.close()
      return result
    } catch (error) {
      await api.close()
      throw error
    }
  }

  async removeHotspotUser(userId: string): Promise<void> {
    const api = await this.getClient()
    try {
      await api.menu("/ip/hotspot/user").remove(userId)
      await api.close()
    } catch (error) {
      await api.close()
      throw error
    }
  }

  async addToAllowedList(macAddress: string, comment: string): Promise<string> {
    const api = await this.getClient()
    try {
      const result = await api.menu("/ip/firewall/address-list").add({
        list: "hotspot-allowed",
        address: macAddress,
        comment,
      })
      await api.close()
      return result
    } catch (error) {
      await api.close()
      throw error
    }
  }

  async removeFromAllowedList(listId: string): Promise<void> {
    const api = await this.getClient()
    try {
      await api.menu("/ip/firewall/address-list").remove(listId)
      await api.close()
    } catch (error) {
      await api.close()
      throw error
    }
  }

  async disconnectActiveUser(macAddress: string): Promise<void> {
    const api = await this.getClient()
    try {
      const active = await api.menu("/ip/hotspot/active").getAll()
      const found = active.find((item: any) => item["mac-address"] === macAddress)
      if (found) {
        await api.menu("/ip/hotspot/active").remove(found[".id"])
      }
      await api.close()
    } catch (error) {
      await api.close()
      throw error
    }
  }
}

export const mikrotikAPI = new MikrotikAPI()

export async function liberarAcesso({
  ip,
  busId,
  list = "hotspot-allowed",
}: LiberarAcessoParams): Promise<LiberarAcessoResult> {
  let api: RouterOSClient | null = null

  try {
    api = new RouterOSClient({
      host: MIKROTIK_CONFIG.host,
      port: MIKROTIK_CONFIG.port,
      user: MIKROTIK_CONFIG.user,
      password: MIKROTIK_CONFIG.password,
      timeout: MIKROTIK_CONFIG.timeout,
      tls: MIKROTIK_CONFIG.tls,
    })

    await api.connect()

    // Check if IP already exists in the list
    const existing = await api.menu("/ip/firewall/address-list").getAll()
    const found = existing.find((item: any) => item.list === list && item.address === ip)

    if (found) {
      await api.close()
      return {
        ok: true,
        list,
        ip,
        id: found[".id"],
        created: false,
      }
    }

    // Add IP to address-list
    const comment = busId ? `Bus: ${busId}` : `Added: ${new Date().toISOString()}`
    const result = await api.menu("/ip/firewall/address-list").add({
      list,
      address: ip,
      comment,
    })

    await api.close()

    return {
      ok: true,
      list,
      ip,
      id: result,
      created: true,
    }
  } catch (error: any) {
    if (api) {
      try {
        await api.close()
      } catch {}
    }

    console.error("[Mikrotik] Error liberating access:", error)
    return {
      ok: false,
      list,
      ip,
      created: false,
      error: error.message || "Unknown error",
    }
  }
}

export async function revogarAcesso(ip: string, list = "hotspot-allowed"): Promise<boolean> {
  let api: RouterOSClient | null = null

  try {
    api = new RouterOSClient({
      host: MIKROTIK_CONFIG.host,
      port: MIKROTIK_CONFIG.port,
      user: MIKROTIK_CONFIG.user,
      password: MIKROTIK_CONFIG.password,
      timeout: MIKROTIK_CONFIG.timeout,
      tls: MIKROTIK_CONFIG.tls,
    })

    await api.connect()

    const existing = await api.menu("/ip/firewall/address-list").getAll()
    const found = existing.find((item: any) => item.list === list && item.address === ip)

    if (found) {
      await api.menu("/ip/firewall/address-list").remove(found[".id"])
    }

    await api.close()
    return true
  } catch (error) {
    if (api) {
      try {
        await api.close()
      } catch {}
    }

    console.error("[Mikrotik] Error revoking access:", error)
    return false
  }
}

interface LiberarClienteParams {
  ip: string
  mac?: string
  busId?: string
  minutos?: number
}

export async function liberarClienteNoMikrotik({
  ip,
  mac,
  busId,
  minutos = 120,
}: LiberarClienteParams): Promise<boolean> {
  try {
    const comment = [
      busId ? `Bus: ${busId}` : null,
      mac ? `MAC: ${mac}` : null,
      `Duration: ${minutos}min`,
      `Added: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join(" | ")

    const result = await mikrotikAPI.addToAllowedList(ip, comment)

    return true
  } catch (error) {
    console.error("[Mikrotik] Error liberating client:", error)
    return false
  }
}

export default MikrotikAPI
export { MikrotikAPI as MikrotikClient }

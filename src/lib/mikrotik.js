import { Client as RouterOSClient } from "ssh2"

const MIKROTIK_CONFIG = {
  host: process.env.MIKROTIK_HOST,
  port: Number.parseInt(process.env.MIKROTIK_PORT || "22"),
  username: process.env.MIKROTIK_USERNAME,
  password: process.env.MIKROTIK_PASSWORD,
  readyTimeout: 10000,
  keepaliveInterval: 10000,
}

class MikrotikClient {
  constructor() {
    this.client = null
    this.stream = null
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.client = new RouterOSClient()

      this.client.on("ready", () => {
        this.client.shell((err, stream) => {
          if (err) {
            reject(err)
            return
          }
          this.stream = stream

          let buffer = ""
          stream.on("data", (data) => {
            buffer += data.toString()
          })

          resolve()
        })
      })

      this.client.on("error", (err) => {
        reject(err)
      })

      this.client.connect(MIKROTIK_CONFIG)
    })
  }

  async executeCommand(command) {
    if (!this.stream) {
      await this.connect()
    }

    return new Promise((resolve, reject) => {
      let output = ""

      const dataHandler = (data) => {
        output += data.toString()
      }

      this.stream.on("data", dataHandler)

      this.stream.write(command + "\n")

      setTimeout(() => {
        this.stream.removeListener("data", dataHandler)
        resolve(output)
      }, 2000)
    })
  }

  async liberarAcesso(mac, ip, tempo) {
    try {
      await this.connect()

      // Adiciona usuário no hotspot
      const addUserCmd = `/ip hotspot user add name="${mac}" password="" mac-address="${mac}" limit-uptime=${tempo}m profile=default`
      await this.executeCommand(addUserCmd)

      // Adiciona IP binding
      const addBindingCmd = `/ip hotspot ip-binding add mac-address="${mac}" address="${ip}" type=bypassed`
      await this.executeCommand(addBindingCmd)

      console.log(`[Mikrotik] Acesso liberado: MAC=${mac}, IP=${ip}, Tempo=${tempo}min`)

      this.disconnect()
      return { success: true }
    } catch (error) {
      console.error("[Mikrotik] Erro ao liberar acesso:", error)
      this.disconnect()
      throw error
    }
  }

  async revogarAcesso(mac, ip) {
    try {
      await this.connect()

      // Remove usuário do hotspot
      const removeUserCmd = `/ip hotspot user remove [find name="${mac}"]`
      await this.executeCommand(removeUserCmd)

      // Remove IP binding
      const removeBindingCmd = `/ip hotspot ip-binding remove [find mac-address="${mac}"]`
      await this.executeCommand(removeBindingCmd)

      // Desconecta sessão ativa
      const disconnectCmd = `/ip hotspot active remove [find mac-address="${mac}"]`
      await this.executeCommand(disconnectCmd)

      console.log(`[Mikrotik] Acesso revogado: MAC=${mac}, IP=${ip}`)

      this.disconnect()
      return { success: true }
    } catch (error) {
      console.error("[Mikrotik] Erro ao revogar acesso:", error)
      this.disconnect()
      throw error
    }
  }

  async getActiveSessions() {
    try {
      await this.connect()

      const cmd = "/ip hotspot active print detail"
      const output = await this.executeCommand(cmd)

      // Parse output para extrair sessões ativas
      const sessions = this.parseActiveSessions(output)

      this.disconnect()
      return sessions
    } catch (error) {
      console.error("[Mikrotik] Erro ao buscar sessões ativas:", error)
      this.disconnect()
      throw error
    }
  }

  parseActiveSessions(output) {
    const sessions = []
    const lines = output.split("\n")

    let currentSession = {}

    for (const line of lines) {
      if (line.includes("server=")) {
        if (Object.keys(currentSession).length > 0) {
          sessions.push(currentSession)
        }
        currentSession = {}
      }

      if (line.includes("user=")) {
        const match = line.match(/user="([^"]+)"/)
        if (match) currentSession.user = match[1]
      }

      if (line.includes("address=")) {
        const match = line.match(/address=([^\s]+)/)
        if (match) currentSession.address = match[1]
      }

      if (line.includes("mac-address=")) {
        const match = line.match(/mac-address=([^\s]+)/)
        if (match) currentSession.macAddress = match[1]
      }

      if (line.includes("uptime=")) {
        const match = line.match(/uptime=([^\s]+)/)
        if (match) currentSession.uptime = match[1]
      }
    }

    if (Object.keys(currentSession).length > 0) {
      sessions.push(currentSession)
    }

    return sessions
  }

  disconnect() {
    if (this.stream) {
      this.stream.end()
      this.stream = null
    }
    if (this.client) {
      this.client.end()
      this.client = null
    }
  }
}

export default MikrotikClient

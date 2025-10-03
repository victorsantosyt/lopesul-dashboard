const PAGARME_API_KEY = process.env.PAGAR_ME_API_KEY
const PAGARME_API_URL = "https://api.pagar.me/core/v5"

class PagarMeClient {
  constructor() {
    this.apiKey = PAGARME_API_KEY
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    }
  }

  async criarPedido(dados) {
    try {
      const payload = {
        customer: {
          name: dados.nome || "Cliente",
          email: dados.email || "cliente@example.com",
          type: "individual",
        },
        items: [
          {
            amount: dados.valor,
            description: dados.descricao,
            quantity: 1,
          },
        ],
        payments: [
          {
            payment_method: "pix",
            pix: {
              expires_in: 3600, // 1 hora
            },
          },
        ],
        metadata: {
          mac_address: dados.macAddress,
          ip_address: dados.ipAddress,
          tempo_minutos: dados.tempoMinutos,
          external_id: dados.externalId,
        },
      }

      const response = await fetch(`${PAGARME_API_URL}/orders`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Erro Pagar.me: ${error.message || response.statusText}`)
      }

      const pedido = await response.json()

      return {
        id: pedido.id,
        status: pedido.status,
        qrCode: pedido.charges[0]?.last_transaction?.qr_code,
        qrCodeUrl: pedido.charges[0]?.last_transaction?.qr_code_url,
        pixCopiaECola: pedido.charges[0]?.last_transaction?.qr_code,
        valor: pedido.amount,
        expiresAt: pedido.charges[0]?.last_transaction?.expires_at,
      }
    } catch (error) {
      console.error("[Pagar.me] Erro ao criar pedido:", error)
      throw error
    }
  }

  async verificarStatus(pedidoId) {
    try {
      const response = await fetch(`${PAGARME_API_URL}/orders/${pedidoId}`, {
        method: "GET",
        headers: this.headers,
      })

      if (!response.ok) {
        throw new Error(`Erro ao verificar status: ${response.statusText}`)
      }

      const pedido = await response.json()

      return {
        id: pedido.id,
        status: pedido.status,
        pago: pedido.status === "paid",
      }
    } catch (error) {
      console.error("[Pagar.me] Erro ao verificar status:", error)
      throw error
    }
  }

  validarWebhookSignature(payload, signature) {
    const crypto = require("crypto")
    const secret = process.env.PAGAR_ME_WEBHOOK_SECRET

    const hmac = crypto.createHmac("sha1", secret)
    hmac.update(payload)
    const calculatedSignature = hmac.digest("hex")

    return calculatedSignature === signature
  }
}

export default PagarMeClient

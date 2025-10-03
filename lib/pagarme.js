class PagarMeClient {
  constructor() {
    this.apiKey = process.env.PAGAR_ME_API_KEY
    this.baseUrl = "https://api.pagar.me/core/v5"
  }

  async createOrder(orderData) {
    try {
      const response = await fetch(`${this.baseUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
        },
        body: JSON.stringify(orderData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Error creating order")
      }

      return { success: true, data }
    } catch (error) {
      console.error("[PagarMe] Error creating order:", error)
      return { success: false, error: error.message }
    }
  }

  async getOrder(orderId) {
    try {
      const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Error fetching order")
      }

      return { success: true, data }
    } catch (error) {
      console.error("[PagarMe] Error fetching order:", error)
      return { success: false, error: error.message }
    }
  }

  async getCharge(chargeId) {
    try {
      const response = await fetch(`${this.baseUrl}/charges/${chargeId}`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Error fetching charge")
      }

      return { success: true, data }
    } catch (error) {
      console.error("[PagarMe] Error fetching charge:", error)
      return { success: false, error: error.message }
    }
  }

  validateWebhook(signature, payload, secret) {
    const crypto = require("crypto")
    const hmac = crypto.createHmac("sha256", secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest("hex")
    return signature === expectedSignature
  }
}

export default PagarMeClient

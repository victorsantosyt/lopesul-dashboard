// Configurações do Pagar.me
export const PAGAR_ME_CONFIG = {
  apiKey: process.env.PAGAR_ME_API_KEY!,
  webhookSecret: process.env.PAGAR_ME_WEBHOOK_SECRET!,
  baseUrl: "https://api.pagar.me/core/v5",
}

// Tipos para Pagar.me
export interface PagarMeCustomer {
  name: string
  email: string
  document: string
  type: "individual" | "company"
  phones?: {
    mobile_phone: {
      country_code: string
      area_code: string
      number: string
    }
  }
}

export interface PagarMeOrder {
  code: string
  amount: number
  currency: "BRL"
  customer: PagarMeCustomer
  items: Array<{
    code: string
    description: string
    amount: number
    quantity: number
  }>
  payments: Array<{
    payment_method: "pix"
    pix: {
      expires_in: number // em segundos
    }
  }>
}

export interface PagarMeOrderResponse {
  id: string
  code: string
  amount: number
  status: string
  charges: Array<{
    id: string
    code: string
    amount: number
    status: string
    payment_method: string
    last_transaction: {
      id: string
      transaction_type: string
      status: string
      qr_code?: string
      qr_code_url?: string
      expires_at?: string
      gateway_response?: {
        errors?: Array<{
          message: string
        }>
      }
    }
  }>
}

const SIMULATION_MODE =
  (process.env.NODE_ENV === "development" && !PAGAR_ME_CONFIG.apiKey) ||
  !PAGAR_ME_CONFIG.apiKey ||
  PAGAR_ME_CONFIG.apiKey.length < 20

function validateApiKey(): { valid: boolean; error?: string } {
  if (!PAGAR_ME_CONFIG.apiKey) {
    return { valid: false, error: "PAGAR_ME_API_KEY não configurada" }
  }

  // Check if using public key instead of secret key
  if (PAGAR_ME_CONFIG.apiKey.startsWith("pk_")) {
    return {
      valid: false,
      error:
        "ERRO: Você está usando a PUBLIC KEY (pk_). Para criar pedidos, use a SECRET KEY (sk_test_6dd001b1f0d544f6bc57d8a90403485a)",
    }
  }

  // Check if using secret key
  if (!PAGAR_ME_CONFIG.apiKey.startsWith("sk_")) {
    return {
      valid: false,
      error: "ERRO: A chave da API deve começar com 'sk_test_' ou 'sk_live_'",
    }
  }

  return { valid: true }
}

// Função para criar pedido no Pagar.me
export async function createPagarMeOrder(orderData: PagarMeOrder): Promise<PagarMeOrderResponse> {
  const keyValidation = validateApiKey()
  if (!keyValidation.valid) {
    console.error("[v0] API Key validation failed:", keyValidation.error)
    throw new Error(keyValidation.error)
  }

  const isTestKey = PAGAR_ME_CONFIG.apiKey?.startsWith("sk_test_")
  console.log("[v0] Pagar.me API Key exists:", !!PAGAR_ME_CONFIG.apiKey)
  console.log("[v0] Pagar.me API Key length:", PAGAR_ME_CONFIG.apiKey?.length || 0)
  console.log("[v0] Pagar.me API Key prefix:", PAGAR_ME_CONFIG.apiKey?.substring(0, 5) || "none")
  console.log("[v0] Is test key:", isTestKey)
  console.log("[v0] Simulation mode:", SIMULATION_MODE)

  if (!SIMULATION_MODE) {
    try {
      const authHeader = `Basic ${Buffer.from(`${PAGAR_ME_CONFIG.apiKey}:`).toString("base64")}`
      console.log("[v0] Attempting real Pagar.me API call")
      console.log("[v0] Request URL:", `${PAGAR_ME_CONFIG.baseUrl}/orders`)
      console.log("[v0] Request body:", JSON.stringify(orderData, null, 2))

      const response = await fetch(`${PAGAR_ME_CONFIG.baseUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(orderData),
      })

      console.log("[v0] Pagar.me response status:", response.status)
      console.log("[v0] Pagar.me response ok:", response.ok)

      if (response.ok) {
        const responseData = await response.json()
        console.log("[v0] ===== PAGAR.ME API SUCCESS =====")
        console.log("[v0] Full response:", JSON.stringify(responseData, null, 2))
        console.log("[v0] Response ID:", responseData.id)
        console.log("[v0] Response status:", responseData.status)

        if (responseData.status === "failed" && responseData.charges && responseData.charges.length > 0) {
          const charge = responseData.charges[0]
          if (charge.last_transaction?.gateway_response?.errors) {
            const errors = charge.last_transaction.gateway_response.errors
            const errorMessages = errors.map((e: any) => e.message).join(", ")
            console.log("[v0] Order failed with errors:", errorMessages)
            throw new Error(`Erro do Pagar.me: ${errorMessages}`)
          }
        }

        console.log("[v0] Number of charges:", responseData.charges?.length || 0)

        if (responseData.charges && responseData.charges.length > 0) {
          const charge = responseData.charges[0]
          console.log("[v0] First charge ID:", charge.id)
          console.log("[v0] First charge status:", charge.status)
          console.log("[v0] Payment method:", charge.payment_method)

          if (charge.last_transaction) {
            console.log("[v0] Transaction ID:", charge.last_transaction.id)
            console.log("[v0] Transaction type:", charge.last_transaction.transaction_type)
            console.log("[v0] Transaction status:", charge.last_transaction.status)
            console.log("[v0] QR Code exists:", !!charge.last_transaction.qr_code)
            console.log("[v0] QR Code length:", charge.last_transaction.qr_code?.length || 0)
            console.log("[v0] QR Code preview:", charge.last_transaction.qr_code?.substring(0, 100))
            console.log("[v0] QR Code URL exists:", !!charge.last_transaction.qr_code_url)
            console.log("[v0] QR Code URL preview:", charge.last_transaction.qr_code_url?.substring(0, 100))
          } else {
            console.log("[v0] WARNING: No last_transaction in charge")
          }
        } else {
          console.log("[v0] WARNING: No charges in response")
        }
        console.log("[v0] ===== END PAGAR.ME RESPONSE =====")

        return responseData
      } else if (response.status === 401) {
        const errorText = await response.text()
        console.log("[v0] Auth failed (401), response:", errorText)
        throw new Error(
          "Autenticação falhou. Verifique se você está usando a SECRET KEY (sk_test_...) e não a PUBLIC KEY (pk_test_...)",
        )
      } else {
        const error = await response.text()
        console.log("[v0] Pagar.me error response (status " + response.status + "):", error)
        throw new Error(`Erro ao criar pedido no Pagar.me: ${error}`)
      }
    } catch (error) {
      console.log("[v0] Pagar.me API error:", error)
      throw error
    }
  }

  console.log("[v0] Using Pagar.me simulation mode")
  const simulatedResponse: PagarMeOrderResponse = {
    id: `sim_${Date.now()}`,
    code: orderData.code,
    amount: orderData.amount,
    status: "pending",
    charges: [
      {
        id: `charge_sim_${Date.now()}`,
        code: `charge_${orderData.code}`,
        amount: orderData.amount,
        status: "pending",
        payment_method: "pix",
        last_transaction: {
          id: `txn_sim_${Date.now()}`,
          transaction_type: "pix",
          status: "pending",
          qr_code:
            "00020126580014BR.GOV.BCB.PIX0136123e4567-e12b-12d1-a456-426614174000520400005303986540510.005802BR5913LOPESUL LTDA6009SAO PAULO62070503***6304ABCD",
          qr_code_url:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
        },
      },
    ],
  }

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return simulatedResponse
}

// Função para verificar status do pedido
export async function getPagarMeOrder(orderId: string): Promise<PagarMeOrderResponse> {
  if (SIMULATION_MODE || orderId.startsWith("sim_")) {
    console.log("[v0] Getting simulated order:", orderId)
    return {
      id: orderId,
      code: `order_${orderId}`,
      amount: 2990,
      status: "pending",
      charges: [
        {
          id: `charge_${orderId}`,
          code: `charge_order_${orderId}`,
          amount: 2990,
          status: "pending",
          payment_method: "pix",
          last_transaction: {
            id: `txn_${orderId}`,
            transaction_type: "pix",
            status: "pending",
            qr_code:
              "00020126580014BR.GOV.BCB.PIX0136123e4567-e12b-12d1-a456-426614174000520400005303986540510.005802BR5913LOPESUL LTDA6009SAO PAULO62070503***6304ABCD",
            qr_code_url:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
        },
      ],
    }
  }

  const response = await fetch(`${PAGAR_ME_CONFIG.baseUrl}/orders/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${PAGAR_ME_CONFIG.apiKey}:`).toString("base64")}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Erro ao buscar pedido no Pagar.me: ${error}`)
  }

  return response.json()
}

// Função para validar webhook do Pagar.me
export function validatePagarMeWebhook(signature: string, payload: string): boolean {
  const crypto = require("crypto")
  const expectedSignature = crypto.createHmac("sha256", PAGAR_ME_CONFIG.webhookSecret).update(payload).digest("hex")

  return signature === expectedSignature
}

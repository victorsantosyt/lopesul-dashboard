"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"

export default function CheckoutPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [pedido, setPedido] = useState(null)
  const [error, setError] = useState(null)
  const [polling, setPolling] = useState(false)

  const macAddress = searchParams.get("mac")
  const ipAddress = searchParams.get("ip")
  const valor = searchParams.get("valor") || "1000" // R$ 10,00 em centavos

  useEffect(() => {
    if (macAddress && ipAddress && !pedido) {
      criarCheckout()
    }
  }, [macAddress, ipAddress])

  useEffect(() => {
    if (pedido && pedido.status === "pending" && !polling) {
      setPolling(true)
      const interval = setInterval(() => {
        verificarPagamento()
      }, 5000) // Verifica a cada 5 segundos

      return () => {
        clearInterval(interval)
        setPolling(false)
      }
    }
  }, [pedido])

  const criarCheckout = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/pagamentos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mac_address: macAddress,
          ip_address: ipAddress,
          valor: Number.parseInt(valor),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar checkout")
      }

      setPedido(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const verificarPagamento = async () => {
    if (!pedido) return

    try {
      const response = await fetch("/api/pagamentos/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedido.pedido_id }),
      })

      const data = await response.json()

      if (data.status === "paid") {
        setPedido({ ...pedido, status: "paid" })
        setPolling(false)
      }
    } catch (err) {
      console.error("[v0] Erro ao verificar pagamento:", err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Gerando pagamento...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Erro ao processar</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
        </div>
      </div>
    )
  }

  if (pedido.status === "paid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-green-500 text-6xl mb-4">✓</div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">Pagamento Confirmado!</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Seu acesso foi liberado com sucesso.</p>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Você já pode navegar livremente. Seu acesso expira em 24 horas.
              </p>
            </div>
            <button
              onClick={() => window.close()}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors w-full"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Liberar Acesso</h1>
          <p className="text-gray-600 dark:text-gray-300">Escaneie o QR Code para pagar</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600 dark:text-gray-300">Valor:</span>
            <span className="text-2xl font-bold text-gray-800 dark:text-white">
              R$ {(pedido.valor / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-300">Tempo de acesso:</span>
            <span className="text-gray-800 dark:text-white font-semibold">24 horas</span>
          </div>
        </div>

        {pedido.charge && pedido.charge.qr_code && (
          <div className="mb-6">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 mb-4">
              <img
                src={pedido.charge.qr_code_url || `data:image/png;base64,${pedido.charge.qr_code}`}
                alt="QR Code PIX"
                className="w-full h-auto"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 text-center">Ou copie o código PIX:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pedido.charge.qr_code}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-800 dark:text-white"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pedido.charge.qr_code)
                    alert("Código PIX copiado!")
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold transition-colors"
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Aguardando pagamento...</span>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            O pagamento será confirmado automaticamente após a aprovação.
          </p>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

export default function PortalPage() {
  const searchParams = useSearchParams()
  const [ip, setIp] = useState("192.168.88.1")
  const [mac, setMac] = useState("00:11:22:33:44:55")
  const [linkOrig, setLinkOrig] = useState("https://www.google.com")
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null)

  useEffect(() => {
    const ipParam = searchParams.get("ip")
    const macParam = searchParams.get("mac")
    const redirectParam = searchParams.get("redirect")

    if (ipParam) setIp(ipParam)
    if (macParam) setMac(macParam)
    if (redirectParam) setLinkOrig(redirectParam)

    loadPlans()

    const interval = setInterval(checkAccess, 10000)
    return () => clearInterval(interval)
  }, [searchParams])

  async function loadPlans() {
    try {
      const response = await fetch("/api/plans")
      const data = await response.json()
      if (data.success && data.plans) {
        setPlans(data.plans.slice(0, 4))
      }
    } catch (error) {
      console.error("Erro ao carregar planos:", error)
    }
  }

  async function checkAccess() {
    try {
      const response = await fetch(`/api/mikrotik/check-access?mac=${encodeURIComponent(mac)}`)
      const data = await response.json()

      if (data.hasAccess) {
        setHasAccess(true)
        setMessage({ type: "success", text: "✅ Pagamento confirmado! Redirecionando..." })
        setTimeout(() => {
          window.location.href = linkOrig
        }, 2000)
      }
    } catch (error) {
      console.error("Erro ao verificar acesso:", error)
    }
  }

  async function handleVerify() {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/mikrotik/check-access?mac=${encodeURIComponent(mac)}`)
      const data = await response.json()

      if (data.hasAccess) {
        setHasAccess(true)
        setMessage({ type: "success", text: "✅ Pagamento confirmado! Redirecionando..." })
        setTimeout(() => {
          window.location.href = linkOrig
        }, 2000)
      } else {
        setMessage({
          type: "error",
          text: "⏳ Pagamento ainda não confirmado. Aguarde alguns segundos após o pagamento.",
        })
      }
    } catch (error) {
      setMessage({ type: "error", text: "❌ Erro ao verificar pagamento. Tente novamente." })
    } finally {
      setLoading(false)
    }
  }

  function handleCheckout() {
    const checkoutUrl = `/checkout?ip=${encodeURIComponent(ip)}&mac=${encodeURIComponent(mac)}&redirect=${encodeURIComponent(linkOrig)}`
    window.location.href = checkoutUrl
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Logo */}
        <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-900 rounded-2xl mx-auto mb-5 flex items-center justify-center text-4xl shadow-lg shadow-purple-500/30">
          📶
        </div>

        {/* Header */}
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">Bem-vindo ao WiFi Lopesul</h1>
        <p className="text-gray-600 text-center mb-8 leading-relaxed">
          Conecte-se à internet de forma rápida e segura com pagamento via PIX
        </p>

        {/* Messages */}
        {message && (
          <div
            className={`rounded-xl p-4 mb-6 ${
              message.type === "error"
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-green-50 border border-green-200 text-green-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 mb-6 border border-gray-200">
          <div className="flex justify-between items-center py-3 border-b border-gray-200">
            <span className="text-gray-600 text-sm font-medium">Seu IP:</span>
            <span className="text-gray-900 font-semibold font-mono text-sm">{ip}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200">
            <span className="text-gray-600 text-sm font-medium">MAC Address:</span>
            <span className="text-gray-900 font-semibold font-mono text-sm">{mac}</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-600 text-sm font-medium">Status:</span>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                hasAccess ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${hasAccess ? "bg-green-500" : "bg-yellow-500"} animate-pulse`} />
              {hasAccess ? "Acesso Liberado" : "Aguardando Pagamento"}
            </span>
          </div>
        </div>

        {/* Plans Preview */}
        <div className="bg-gray-50 rounded-xl p-5 mb-6">
          <div className="text-sm font-semibold text-gray-700 mb-3 text-center">📋 Planos Disponíveis</div>
          {plans.length > 0 ? (
            <div className="space-y-2">
              {plans.map((plan, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0"
                >
                  <span className="text-gray-900 font-medium text-sm">{plan.name}</span>
                  <span className="text-purple-600 font-bold text-sm">R$ {(plan.price_cents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-center py-4">
              <div className="w-8 h-8 border-3 border-gray-300 border-t-purple-600 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Buttons */}
        <button
          onClick={handleCheckout}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-900 text-white py-4 rounded-xl font-semibold text-base mb-3 hover:shadow-lg hover:shadow-purple-500/50 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
        >
          <span>🚀</span>
          <span>Comprar Acesso à Internet</span>
        </button>

        <button
          onClick={handleVerify}
          disabled={loading}
          className="w-full bg-white text-gray-700 py-4 rounded-xl font-semibold text-base border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
              <span>Verificando...</span>
            </>
          ) : (
            <>
              <span>🔄</span>
              <span>Já Paguei - Verificar Acesso</span>
            </>
          )}
        </button>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
          <div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
            <span>💳</span>
            <span>Pagamento via PIX instantâneo</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
            <span>⚡</span>
            <span>Liberação automática após confirmação</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
            <span>🔒</span>
            <span>Conexão segura e criptografada</span>
          </div>
        </div>
      </div>
    </div>
  )
}

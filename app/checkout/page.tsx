"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { QRCodeSVG } from "qrcode.react"
import { validateDocument, formatDocument } from "@/lib/validators"
import { RefreshCw, Loader2, CheckCircle2, Clock } from "lucide-react"

export default function CheckoutPage() {
  const [plans, setPlans] = useState<any[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerDocument: "",
    macAddress: "",
  })
  const [payment, setPayment] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<string>("pending")
  const [documentError, setDocumentError] = useState<string>("")
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [timeUntilNextCheck, setTimeUntilNextCheck] = useState(10)

  useEffect(() => {
    const cachedPlans = localStorage.getItem("hotspot_plans")
    const cacheTime = localStorage.getItem("hotspot_plans_time")
    const now = Date.now()

    // Use cache if less than 5 minutes old
    if (cachedPlans && cacheTime && now - Number.parseInt(cacheTime) < 5 * 60 * 1000) {
      setPlans(JSON.parse(cachedPlans))
      setPlansLoading(false)
      console.log("[v0] Using cached plans")
      return
    }

    // Fetch fresh plans
    fetch("/api/plans")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPlans(data.plans)
          localStorage.setItem("hotspot_plans", JSON.stringify(data.plans))
          localStorage.setItem("hotspot_plans_time", now.toString())
          console.log("[v0] Plans cached")
        }
      })
      .catch((error) => {
        console.error("[v0] Error fetching plans:", error)
      })
      .finally(() => {
        setPlansLoading(false)
      })
  }, [])

  useEffect(() => {
    if (payment && paymentStatus === "pending") {
      const interval = setInterval(() => {
        fetch(`/api/payment/status/${payment.id}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setPaymentStatus(data.payment.status)
              if (data.payment.status === "paid") {
                clearInterval(interval)
                console.log("[v0] Payment confirmed!")
              }
            }
          })
          .catch((error) => {
            console.error("[v0] Error checking payment status:", error)
          })
        setTimeUntilNextCheck(10)
      }, 10000) // Increased from 5s to 10s to save bandwidth

      // Countdown timer
      const countdownInterval = setInterval(() => {
        setTimeUntilNextCheck((prev) => (prev > 0 ? prev - 1 : 10))
      }, 1000)

      return () => {
        clearInterval(interval)
        clearInterval(countdownInterval)
      }
    }
  }, [payment, paymentStatus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlan) return

    if (!validateDocument(formData.customerDocument)) {
      setDocumentError("CPF ou CNPJ inválido. Por favor, verifique o número digitado.")
      return
    }
    setDocumentError("")

    setLoading(true)
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          ...formData,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setPayment(data.payment)
        setPaymentStatus("pending")
        console.log("[v0] Payment created successfully")
      } else {
        console.error("[v0] Checkout error:", data.error)
        if (data.error?.includes("Invalid CPF") || data.error?.includes("Invalid CNPJ")) {
          setDocumentError("CPF ou CNPJ inválido. Por favor, verifique o número digitado.")
        } else {
          alert(data.error || "Erro ao criar pagamento")
        }
      }
    } catch (error) {
      console.error("[v0] Checkout error:", error)
      alert("Erro ao processar pagamento")
    } finally {
      setLoading(false)
    }
  }

  const checkPaymentStatus = async () => {
    if (!payment) return

    setCheckingStatus(true)
    try {
      const response = await fetch(`/api/payment/check-status/${payment.id}`, {
        method: "POST",
      })
      const data = await response.json()

      if (data.success) {
        setPaymentStatus(data.status)
        console.log("[v0] Payment status checked:", data.status)
        if (data.changed) {
          alert(data.status === "paid" ? "Pagamento confirmado!" : "Status atualizado")
        }
      }
    } catch (error) {
      console.error("[v0] Error checking payment status:", error)
      alert("Erro ao verificar status. Tente novamente.")
    } finally {
      setCheckingStatus(false)
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100)
  }

  if (payment) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {paymentStatus === "paid" ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  Pagamento Confirmado!
                </>
              ) : (
                <>
                  <Clock className="h-6 w-6 text-blue-500" />
                  Aguardando Pagamento
                </>
              )}
            </CardTitle>
            <CardDescription>
              {paymentStatus === "paid"
                ? "Seu acesso foi liberado automaticamente"
                : "Escaneie o QR Code com o app do seu banco"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {paymentStatus === "paid" ? (
              <div className="text-center space-y-4 py-6">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-20 w-20 text-green-500" />
                </div>
                <Badge variant="default" className="text-lg px-4 py-2">
                  Acesso Liberado!
                </Badge>
                <div className="space-y-2">
                  <p className="font-semibold text-lg">Conecte-se à rede WiFi</p>
                  <p className="text-muted-foreground">Você será redirecionado automaticamente para a internet.</p>
                  <p className="text-sm text-muted-foreground">
                    Seu acesso expira em {selectedPlan?.duration_hours || "24"} horas.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg flex justify-center">
                  <QRCodeSVG value={payment.qr_code} size={240} level="H" />
                </div>

                <div className="text-center space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Valor a pagar</p>
                    <p className="text-3xl font-bold">{formatCurrency(payment.amount)}</p>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Expira em: {new Date(payment.expires_at).toLocaleTimeString("pt-BR")}</span>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="secondary" className="text-sm">
                      Verificando automaticamente em {timeUntilNextCheck}s
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button onClick={checkPaymentStatus} disabled={checkingStatus} size="lg" className="w-full">
                    {checkingStatus ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-5 w-5" />
                        Já Paguei? Verificar Agora
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    O sistema verifica automaticamente a cada 10 segundos
                  </p>
                </div>

                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="font-semibold text-sm">Como pagar:</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Abra o app do seu banco</li>
                    <li>Escolha "Pagar com PIX"</li>
                    <li>Escaneie o QR Code acima</li>
                    <li>Confirme o pagamento</li>
                  </ol>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Acesso WiFi - Escolha seu Plano</CardTitle>
          <CardDescription>Pagamento rápido e seguro via PIX</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Escolha seu plano</Label>
              {plansLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {plans.map((plan) => (
                    <Card
                      key={plan.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedPlan?.id === plan.id ? "ring-2 ring-primary shadow-md" : ""
                      }`}
                      onClick={() => setSelectedPlan(plan)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-lg">{plan.name}</h3>
                            <p className="text-sm text-muted-foreground">{plan.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">{formatCurrency(plan.price_cents)}</p>
                            <p className="text-xs text-muted-foreground">via PIX</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="customerName">Nome completo</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="João da Silva"
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  placeholder="joao@email.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerPhone">Telefone</Label>
                <Input
                  id="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label htmlFor="customerDocument">CPF/CNPJ</Label>
                <Input
                  id="customerDocument"
                  value={formData.customerDocument}
                  onChange={(e) => {
                    const formatted = formatDocument(e.target.value)
                    setFormData({ ...formData, customerDocument: formatted })
                    setDocumentError("")
                  }}
                  className={documentError ? "border-red-500" : ""}
                  placeholder="000.000.000-00"
                  required
                />
                {documentError && <p className="text-sm text-red-500 mt-1">{documentError}</p>}
              </div>
              <div>
                <Label htmlFor="macAddress">MAC Address do dispositivo</Label>
                <Input
                  id="macAddress"
                  value={formData.macAddress}
                  onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  required
                />
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={!selectedPlan || loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : (
                "Gerar QR Code PIX"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

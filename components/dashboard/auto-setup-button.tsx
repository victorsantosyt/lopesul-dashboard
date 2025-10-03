"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Zap, CheckCircle, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export function AutoSetupButton() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const router = useRouter()

  const handleSetup = async () => {
    setLoading(true)
    setStatus("idle")
    setMessage("")

    try {
      const response = await fetch("/api/setup/database", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStatus("success")
        setMessage("Banco de dados inicializado com sucesso!")

        // Recarregar a página após 2 segundos
        setTimeout(() => {
          router.refresh()
        }, 2000)
      } else {
        setStatus("error")
        setMessage(data.error || "Erro ao inicializar banco de dados")

        // Se falhar, mostrar instruções manuais
        if (data.instructions) {
          console.log("Instruções manuais:", data.instructions)
        }
      }
    } catch (error) {
      setStatus("error")
      setMessage("Erro de conexão. Tente a configuração manual.")
      console.error("Setup error:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        onClick={handleSetup}
        disabled={loading || status === "success"}
        className="bg-green-600 hover:bg-green-700"
      >
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {status === "success" && <CheckCircle className="h-4 w-4 mr-2" />}
        {status === "error" && <XCircle className="h-4 w-4 mr-2" />}
        {status === "idle" && !loading && <Zap className="h-4 w-4 mr-2" />}
        {loading ? "Inicializando..." : status === "success" ? "Concluído!" : "Inicializar Banco Automaticamente"}
      </Button>

      {message && <p className={`text-xs ${status === "success" ? "text-green-600" : "text-red-600"}`}>{message}</p>}
    </div>
  )
}

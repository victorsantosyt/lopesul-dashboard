import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request) {
  try {
    // Verificar se é admin
    const cookieStore = await cookies()
    const isAdmin = cookieStore.get("is_admin")?.value === "true"

    if (!isAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    // Chamar a API de limpeza
    const cronSecret = process.env.CRON_SECRET || "seu-token-secreto-aqui"
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

    const response = await fetch(`${baseUrl}/api/cron/limpeza`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    })

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Erro ao executar limpeza manual:", error)
    return NextResponse.json({ error: "Erro ao executar limpeza", details: error.message }, { status: 500 })
  }
}

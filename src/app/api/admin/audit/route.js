import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { buscarLogs } from "@/lib/audit"

export async function GET(request) {
  try {
    // Verificar se é admin
    const cookieStore = await cookies()
    const isAdmin = cookieStore.get("is_admin")?.value === "true"

    if (!isAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    const filtros = {
      acao: searchParams.get("acao"),
      entidade: searchParams.get("entidade"),
      entidadeId: searchParams.get("entidade_id"),
      operadorId: searchParams.get("operador_id"),
      dataInicio: searchParams.get("data_inicio"),
      dataFim: searchParams.get("data_fim"),
      page: Number.parseInt(searchParams.get("page") || "1"),
      limit: Number.parseInt(searchParams.get("limit") || "50"),
    }

    const resultado = await buscarLogs(filtros)

    return NextResponse.json(resultado)
  } catch (error) {
    console.error("[v0] Erro ao buscar logs de auditoria:", error)
    return NextResponse.json({ error: "Erro ao buscar logs", details: error.message }, { status: 500 })
  }
}

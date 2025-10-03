import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function registrarAuditoria({ acao, detalhes, usuario_id, ip, user_agent, metodo, rota }) {
  try {
    const { data, error } = await supabase.from("system_logs").insert({
      action: acao,
      details: detalhes,
      user_id: usuario_id,
      ip_address: ip,
      user_agent,
      method: metodo,
      route: rota,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error("[Audit] Error registering audit:", error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error("[Audit] Error registering audit:", error)
    return { success: false, error }
  }
}

export function extrairInfoRequisicao(request) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  const user_agent = request.headers.get("user-agent") || "unknown"
  const metodo = request.method
  const rota = new URL(request.url).pathname

  return { ip, user_agent, metodo, rota }
}

export async function buscarLogs({ limite = 100, offset = 0, filtros = {} }) {
  try {
    let query = supabase
      .from("system_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limite - 1)

    if (filtros.action) {
      query = query.eq("action", filtros.action)
    }

    if (filtros.user_id) {
      query = query.eq("user_id", filtros.user_id)
    }

    if (filtros.data_inicio) {
      query = query.gte("created_at", filtros.data_inicio)
    }

    if (filtros.data_fim) {
      query = query.lte("created_at", filtros.data_fim)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("[Audit] Error fetching logs:", error)
      return { success: false, error }
    }

    return {
      success: true,
      logs: data,
      total: count,
      limite,
      offset,
    }
  } catch (error) {
    console.error("[Audit] Error fetching logs:", error)
    return { success: false, error }
  }
}

"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"

const ACOES = [
  "PAGAMENTO_CRIADO",
  "PAGAMENTO_PAGO",
  "PAGAMENTO_CANCELADO",
  "ACESSO_LIBERADO",
  "ACESSO_REVOGADO",
  "SESSAO_EXPIRADA",
  "WEBHOOK_RECEBIDO",
  "LIMPEZA_EXECUTADA",
  "LOGIN_ADMIN",
  "CONFIGURACAO_ALTERADA",
]

const ENTIDADES = ["Pedido", "Sessao", "Webhook", "Config", "Operador"]

export default function AuditPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    acao: "",
    entidade: "",
    data_inicio: "",
    data_fim: "",
    page: 1,
  })
  const [pagination, setPagination] = useState(null)
  const [detalhesAberto, setDetalhesAberto] = useState(null)

  useEffect(() => {
    if (!isAdmin) {
      router.push("/login")
      return
    }
    carregarLogs()
  }, [filtros, isAdmin])

  const carregarLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtros.acao) params.append("acao", filtros.acao)
      if (filtros.entidade) params.append("entidade", filtros.entidade)
      if (filtros.data_inicio) params.append("data_inicio", filtros.data_inicio)
      if (filtros.data_fim) params.append("data_fim", filtros.data_fim)
      params.append("page", filtros.page)

      const response = await fetch(`/api/admin/audit?${params}`)
      const data = await response.json()

      if (response.ok) {
        setLogs(data.logs)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("[v0] Erro ao carregar logs:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Logs de Auditoria</h1>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ação</label>
              <select
                value={filtros.acao}
                onChange={(e) => setFiltros({ ...filtros, acao: e.target.value, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option value="">Todas</option>
                {ACOES.map((acao) => (
                  <option key={acao} value={acao}>
                    {acao.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Entidade</label>
              <select
                value={filtros.entidade}
                onChange={(e) => setFiltros({ ...filtros, entidade: e.target.value, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option value="">Todas</option>
                {ENTIDADES.map((entidade) => (
                  <option key={entidade} value={entidade}>
                    {entidade}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data Início</label>
              <input
                type="date"
                value={filtros.data_inicio}
                onChange={(e) => setFiltros({ ...filtros, data_inicio: e.target.value, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data Fim</label>
              <input
                type="date"
                value={filtros.data_fim}
                onChange={(e) => setFiltros({ ...filtros, data_fim: e.target.value, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Data/Hora
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Ação
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Entidade
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        IP
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Detalhes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-white">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-white">
                          {log.acao.replace(/_/g, " ")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-white">
                          {log.entidade}
                          {log.entidadeId && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 block">
                              {log.entidadeId.substring(0, 8)}...
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {log.sucesso ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Sucesso
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Erro
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-white font-mono">
                          {log.ipAddress || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setDetalhesAberto(detalhesAberto === log.id ? null : log.id)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {detalhesAberto === log.id ? "Ocultar" : "Ver"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {logs.map(
                      (log) =>
                        detalhesAberto === log.id && (
                          <tr key={`details-${log.id}`} className="bg-gray-50 dark:bg-gray-700">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="text-sm">
                                {log.detalhes && (
                                  <div className="mb-2">
                                    <strong className="text-gray-700 dark:text-gray-300">Detalhes:</strong>
                                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(log.detalhes, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.erro && (
                                  <div className="mb-2">
                                    <strong className="text-red-600 dark:text-red-400">Erro:</strong>
                                    <p className="mt-1 text-red-600 dark:text-red-400">{log.erro}</p>
                                  </div>
                                )}
                                {log.operadorNome && (
                                  <div>
                                    <strong className="text-gray-700 dark:text-gray-300">Operador:</strong>
                                    <span className="ml-2 text-gray-600 dark:text-gray-400">{log.operadorNome}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ),
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {pagination && pagination.pages > 1 && (
                <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Página {pagination.page} de {pagination.pages} ({pagination.total} registros)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFiltros({ ...filtros, page: filtros.page - 1 })}
                      disabled={filtros.page === 1}
                      className="px-4 py-2 bg-white dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setFiltros({ ...filtros, page: filtros.page + 1 })}
                      disabled={filtros.page === pagination.pages}
                      className="px-4 py-2 bg-white dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

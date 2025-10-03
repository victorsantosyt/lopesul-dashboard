"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"

export default function AdminPagamentosPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [pagamentos, setPagamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    status: "",
    data_inicio: "",
    data_fim: "",
    mac_address: "",
    page: 1,
  })
  const [pagination, setPagination] = useState(null)

  useEffect(() => {
    if (!isAdmin) {
      router.push("/login")
      return
    }
    carregarPagamentos()
  }, [filtros, isAdmin])

  const carregarPagamentos = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtros.status) params.append("status", filtros.status)
      if (filtros.data_inicio) params.append("data_inicio", filtros.data_inicio)
      if (filtros.data_fim) params.append("data_fim", filtros.data_fim)
      if (filtros.mac_address) params.append("mac_address", filtros.mac_address)
      params.append("page", filtros.page)

      const response = await fetch(`/api/pagamentos/listar?${params}`)
      const data = await response.json()

      if (response.ok) {
        setPagamentos(data.pedidos)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("[v0] Erro ao carregar pagamentos:", error)
    } finally {
      setLoading(false)
    }
  }

  const revogarAcesso = async (pedidoId) => {
    if (!confirm("Tem certeza que deseja revogar o acesso?")) return

    try {
      const response = await fetch("/api/pagamentos/revogar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id: pedidoId }),
      })

      if (response.ok) {
        alert("Acesso revogado com sucesso!")
        carregarPagamentos()
      } else {
        const data = await response.json()
        alert(`Erro: ${data.error}`)
      }
    } catch (error) {
      alert("Erro ao revogar acesso")
    }
  }

  const exportarRelatorio = async () => {
    try {
      const params = new URLSearchParams()
      if (filtros.data_inicio) params.append("data_inicio", filtros.data_inicio)
      if (filtros.data_fim) params.append("data_fim", filtros.data_fim)
      params.append("formato", "csv")

      window.open(`/api/pagamentos/relatorio?${params}`, "_blank")
    } catch (error) {
      alert("Erro ao exportar relatório")
    }
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gerenciar Pagamentos</h1>
          <button
            onClick={exportarRelatorio}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            Exportar CSV
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros({ ...filtros, status: e.target.value, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option value="">Todos</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="canceled">Cancelado</option>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">MAC Address</label>
              <input
                type="text"
                value={filtros.mac_address}
                onChange={(e) => setFiltros({ ...filtros, mac_address: e.target.value, page: 1 })}
                placeholder="00:00:00:00:00:00"
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        MAC Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Acesso
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {pagamentos.map((pagamento) => (
                      <tr key={pagamento.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-white">
                          {pagamento.id.substring(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              pagamento.status === "paid"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : pagamento.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            }`}
                          >
                            {pagamento.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-white">
                          R$ {(pagamento.valor / 100).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-white font-mono">
                          {pagamento.mac_address}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {pagamento.acesso_liberado ? (
                            <span className="text-green-600 dark:text-green-400">✓ Liberado</span>
                          ) : (
                            <span className="text-gray-400">Não liberado</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-white">
                          {new Date(pagamento.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {pagamento.acesso_liberado && pagamento.sessao_ativa?.status === "active" && (
                            <button
                              onClick={() => revogarAcesso(pagamento.id)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-semibold"
                            >
                              Revogar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
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
                      className="px-4 py-2 bg-white dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-500"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setFiltros({ ...filtros, page: filtros.page + 1 })}
                      disabled={filtros.page === pagination.pages}
                      className="px-4 py-2 bg-white dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-500"
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

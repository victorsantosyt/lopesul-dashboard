"use client";
import { useEffect } from "react";
import ProtectedRoute from '../../components/ProtectedRoute';

export default function Dashboard() {
  const vendas = {
    doDia: null,
    noMes: null,
    total: null,
    acessosAtivos: null,
  };

  const acessos = [];
  const status = {
    starlink: null,
    mikrotik: null,
  };

  const ultimosPagamentos = [];

  return (
    <ProtectedRoute>
      <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { title: "Vendas do Dia", value: vendas.doDia },
            { title: "Vendas no Mês", value: vendas.noMes },
            { title: "Total de Vendas", value: vendas.total },
            { title: "Acessos Ativos", value: vendas.acessosAtivos },
          ].map(({ title, value }) => (
            <div
              key={title}
              className="bg-blue-500 dark:bg-blue-600 text-white rounded-xl p-4 text-center shadow transition-colors"
            >
              <div className="text-sm">{title}</div>
              <div className="text-2xl font-bold">{value ?? "--"}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#232e47] rounded-xl p-4 shadow col-span-2 transition-colors">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Acessos Ativos</h2>
            <table className="w-full text-sm text-gray-700 dark:text-gray-300">
              <thead className="text-left border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="text-gray-800 dark:text-white">Nome</th>
                  <th className="text-gray-800 dark:text-white">Tempo Restante</th>
                  <th className="text-center text-gray-800 dark:text-white">Ações</th>
                </tr>
              </thead>
              <tbody>
                {acessos.length > 0 ? (
                  acessos.map(({ nome, tempoRestante }) => (
                    <tr key={nome} className="border-b border-gray-200 dark:border-gray-600">
                      <td className="py-2">{nome}</td>
                      <td>{tempoRestante}</td>
                      <td className="text-center">
                        <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md transition">
                          Bloquear
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="text-center py-4 text-gray-400 dark:text-gray-500">
                      Sem acessos no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <div className="bg-white dark:bg-[#232e47] p-4 rounded-xl shadow transition-colors">
              <h3 className="font-semibold mb-2 text-gray-800 dark:text-white">Starlink</h3>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    status.starlink === "online"
                      ? "bg-green-500"
                      : "bg-gray-400"
                  }`}
                ></div>
                <span className="text-gray-700 dark:text-gray-300">{status.starlink ?? "Aguardando..."}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#232e47] p-4 rounded-xl shadow transition-colors">
              <h3 className="font-semibold mb-2 text-gray-800 dark:text-white">MikroTik</h3>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    status.mikrotik === "online"
                      ? "bg-green-500"
                      : "bg-gray-400"
                  }`}
                ></div>
                <span className="text-gray-700 dark:text-gray-300">{status.mikrotik ?? "Aguardando..."}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#232e47] p-4 rounded-xl shadow transition-colors">
              <h3 className="font-semibold mb-2 text-gray-800 dark:text-white">Últimos Pagamentos</h3>
              <ul className="text-sm">
                {ultimosPagamentos.length > 0 ? (
                  ultimosPagamentos.map(({ data, cliente, valor, tipo }, i) => (
                    <li key={i} className="flex justify-between text-gray-700 dark:text-gray-300">
                      <span>{data}</span>
                      <span className="font-medium">{cliente}</span>
                      <span
                        className={`text-right ${
                          tipo === "Aprovado"
                            ? "text-green-600 dark:text-green-400"
                            : "text-blue-500 dark:text-blue-400"
                        }`}
                      >
                        {valor}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-center text-gray-400 dark:text-gray-500">
                    Nenhum pagamento ainda.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

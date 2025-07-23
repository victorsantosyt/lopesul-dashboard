"use client";

export default function AcessosPage() {
  const acessos = []; // futuramente preenchido via API

  return (
    <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors">
      <div className="bg-white dark:bg-[#232e47] rounded-xl p-6 shadow">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
          Acompanhamento de Acessos
        </h1>
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <input
          type="text"
          placeholder="Buscar por nome ou IP"
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md w-full md:w-1/3 bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100"
        />
        <select className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100">
          <option>Últimas 24h</option>
          <option>Hoje</option>
          <option>Esta semana</option>
          <option>Este mês</option>
        </select>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md">
          Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl shadow bg-white dark:bg-[#232e47] transition-colors">
        <table className="min-w-full text-sm text-left text-gray-700 dark:text-gray-200">
          <thead className="bg-gray-100 dark:bg-[#1a2233] text-gray-700 dark:text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">IP / MAC</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Tempo Conectado</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {acessos.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-6 text-gray-400 dark:text-gray-500">
                  Nenhum acesso registrado.
                </td>
              </tr>
            ) : (
              acessos.map((item, index) => (
                <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2">{item.nome}</td>
                  <td className="px-4 py-2">{item.ip}</td>
                  <td className="px-4 py-2">{item.plano}</td>
                  <td className="px-4 py-2">{item.tempo}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-white text-xs ${
                      item.status === "Ativo" ? "bg-green-500" :
                      item.status === "Expirado" ? "bg-gray-400" :
                      "bg-red-500"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button className="text-red-600 dark:text-red-400 hover:underline text-sm">
                      Bloquear
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
"use client";

export default function AcessosPage() {
  const acessos = []; // futuramente preenchido via API

  return (
    <div className="p-6 md:p-8 bg-white min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Acompanhamento de Acessos</h1>

      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <input
          type="text"
          placeholder="Buscar por nome ou IP"
          className="px-4 py-2 border border-gray-300 rounded-md w-full md:w-1/3"
        />
        <select className="px-4 py-2 border border-gray-300 rounded-md">
          <option>Últimas 24h</option>
          <option>Hoje</option>
          <option>Esta semana</option>
          <option>Este mês</option>
        </select>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md">
          Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl shadow bg-white">
        <table className="min-w-full text-sm text-left text-gray-700">
          <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
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
                <td colSpan="6" className="text-center py-6 text-gray-400">Nenhum acesso registrado.</td>
              </tr>
            ) : (
              acessos.map((item, index) => (
                <tr key={index} className="border-t">
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
                    <button className="text-red-600 hover:underline text-sm">Bloquear</button>
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

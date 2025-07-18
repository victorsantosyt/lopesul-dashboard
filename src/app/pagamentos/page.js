"use client";

export default function PagamentosPage() {
  const pagamentos = []; // futuro preenchido com API

  return (
    <div className="p-6 md:p-8 bg-white min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Histórico de Pagamentos</h1>

      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <input
          type="text"
          placeholder="Buscar por cliente ou valor"
          className="px-4 py-2 border border-gray-300 rounded-md w-full md:w-1/3"
        />
        <select className="px-4 py-2 border border-gray-300 rounded-md">
          <option>Todos os períodos</option>
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
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Forma de Pagamento</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pagamentos.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-6 text-gray-400">
                  Nenhum pagamento encontrado.
                </td>
              </tr>
            ) : (
              pagamentos.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="px-4 py-2">{item.cliente}</td>
                  <td className="px-4 py-2">R$ {item.valor}</td>
                  <td className="px-4 py-2">{item.forma}</td>
                  <td className="px-4 py-2">{item.data}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-white text-xs ${
                      item.status === "Aprovado" ? "bg-green-500" :
                      item.status === "Pendente" ? "bg-yellow-500" :
                      "bg-red-500"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button className="text-blue-600 hover:underline text-sm">Ver Detalhes</button>
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

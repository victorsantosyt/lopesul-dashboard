"use client";

export default function RelatoriosPage() {
  // Aqui você vai depois conectar os dados reais
  const resumo = {
    totalVendas: 0,
    receita: 0,
    mediaTempoAcesso: "0 min",
  };

  return (
    <div className="p-6 md:p-8 bg-white min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Relatórios e Análises</h1>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-100 text-blue-900 rounded-xl p-4 shadow">
          <h3 className="text-sm">Total de Vendas</h3>
          <p className="text-2xl font-bold">{resumo.totalVendas}</p>
        </div>
        <div className="bg-green-100 text-green-900 rounded-xl p-4 shadow">
          <h3 className="text-sm">Receita Total</h3>
          <p className="text-2xl font-bold">R$ {resumo.receita}</p>
        </div>
        <div className="bg-yellow-100 text-yellow-900 rounded-xl p-4 shadow">
          <h3 className="text-sm">Tempo Médio de Acesso</h3>
          <p className="text-2xl font-bold">{resumo.mediaTempoAcesso}</p>
        </div>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <select className="px-4 py-2 border border-gray-300 rounded-md">
          <option>Hoje</option>
          <option>Últimos 7 dias</option>
          <option>Este mês</option>
          <option>Personalizado</option>
        </select>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md">
          Exportar PDF
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 text-center text-gray-400">
        {/* Aqui no futuro você pode inserir gráficos com Recharts ou Chart.js */}
        <p>Gráficos de desempenho ainda não implementados.</p>
      </div>
    </div>
  );
}

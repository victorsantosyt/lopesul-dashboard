"use client";

export default function RelatoriosPage() {
  // Aqui você vai depois conectar os dados reais
  const resumo = {
    totalVendas: 0,
    receita: 0,
    mediaTempoAcesso: "0 min",
  };

  return (
    <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
        Relatórios e Análises
      </h1>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-xl p-4 shadow transition-colors">
          <h3 className="text-sm">Total de Vendas</h3>
          <p className="text-2xl font-bold">{resumo.totalVendas}</p>
        </div>
        <div className="bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 rounded-xl p-4 shadow transition-colors">
          <h3 className="text-sm">Receita Total</h3>
          <p className="text-2xl font-bold">R$ {resumo.receita}</p>
        </div>
        <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 rounded-xl p-4 shadow transition-colors">
          <h3 className="text-sm">Tempo Médio de Acesso</h3>
          <p className="text-2xl font-bold">{resumo.mediaTempoAcesso}</p>
        </div>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <select className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100">
          <option>Hoje</option>
          <option>Últimos 7 dias</option>
          <option>Este mês</option>
          <option>Personalizado</option>
        </select>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md">
          Exportar PDF
        </button>
      </div>

      <div className="bg-white dark:bg-[#232e47] rounded-xl shadow p-4 text-center text-gray-400 dark:text-gray-500 transition-colors">
        {/* Aqui no futuro você pode inserir gráficos com Recharts ou Chart.js */}
        <p>Gráficos de desempenho ainda não implementados.</p>
      </div>
    </div>
  );
}
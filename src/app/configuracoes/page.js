"use client";

export default function ConfiguracoesPage() {
  return (
    <div className="p-6 md:p-8 bg-white min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configurações do Sistema</h1>

      <div className="bg-white rounded-xl p-6 shadow space-y-6 max-w-2xl">
        <div>
          <label className="block font-medium mb-1 text-sm">Nome da Rede</label>
          <input
            type="text"
            placeholder="LOPESUL WI-FI"
            className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block font-medium mb-1 text-sm">Tema do Sistema</label>
          <select className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm">
            <option>Claro</option>
            <option>Escuro</option>
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1 text-sm">Modo de Manutenção</label>
          <div className="flex items-center gap-3 mt-1">
            <input type="checkbox" id="manutencao" className="w-4 h-4" />
            <label htmlFor="manutencao" className="text-sm">Ativar modo de manutenção</label>
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1 text-sm">Tempo de sessão</label>
          <input
            type="number"
            placeholder="Em minutos"
            className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm"
          />
        </div>

        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md">
          Salvar Alterações
        </button>
      </div>
    </div>
  );
}
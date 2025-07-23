"use client";
import { useState } from "react";
import { useTheme } from '../../context/ThemeContext';

export default function ConfiguracoesPage() {
  // Estados para cada campo
  const [nomeRede, setNomeRede] = useState("Lopesul wi-fi");
  const [manutencao, setManutencao] = useState(false);
  const [tempoSessao, setTempoSessao] = useState("");

  // Usa o contexto global de tema
  const { tema, setTema } = useTheme();

 const handleSalvar = (e) => {
  e.preventDefault();
  localStorage.setItem('nomeRede', nomeRede);
  localStorage.setItem('tema', tema);
  localStorage.setItem('manutencao', manutencao);

  // Garante que tempoSessao seja um número válido e maior que zero
  const tempo = parseInt(tempoSessao);
  localStorage.setItem('tempoSessao', tempo > 0 ? tempo : 15);

  alert(
    `Configurações salvas:\nNome da Rede: ${nomeRede}\nTema: ${tema}\nModo de Manutenção: ${manutencao ? "Ativo" : "Inativo"}\nTempo de sessão: ${tempo > 0 ? tempo : 15} min`
  );
};

  return (
    <div className="p-6 md:p-8 bg-white dark:bg-[#1a2233] min-h-screen transition-colors">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
        Configurações do Sistema
      </h1>

      <form
        onSubmit={handleSalvar}
        className="bg-white dark:bg-[#232e47] rounded-xl p-6 shadow space-y-6 max-w-2xl"
      >
        <div>
          <label className="block font-medium mb-1 text-sm dark:text-gray-200">
            Nome da Rede
          </label>
          <input
            type="text"
            value={nomeRede}
            onChange={e => setNomeRede(e.target.value)}
            placeholder="LOPESUL WI-FI"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 text-sm bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block font-medium mb-1 text-sm dark:text-gray-200">
            Tema do Sistema
          </label>
          <select
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 text-sm bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
            value={tema}
            onChange={e => setTema(e.target.value)}
          >
            <option value="claro">Claro</option>
            <option value="escuro">Escuro</option>
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1 text-sm dark:text-gray-200">
            Modo de Manutenção
          </label>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="checkbox"
              id="manutencao"
              checked={manutencao}
              onChange={e => setManutencao(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="manutencao" className="text-sm dark:text-gray-200">
              Ativar modo de manutenção
            </label>
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1 text-sm dark:text-gray-200">
            Tempo de sessão
          </label>
          <input
            type="number"
            value={tempoSessao}
            onChange={e => setTempoSessao(e.target.value)}
            placeholder="Em minutos"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 text-sm bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition"
        >
          Salvar Alterações
        </button>
      </form>
    </div>
  );
}
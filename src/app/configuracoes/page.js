"use client";
import { useEffect, useState } from "react";
import { useTheme } from '../../context/ThemeContext';

const DUR_OPTIONS = [
  { key: '3h', label: '3 horas', seconds: 3*60*60 },
  { key: '4h', label: '4 horas', seconds: 4*60*60 },
  { key: '6h', label: '6 horas', seconds: 6*60*60 },
  { key: '24h', label: '24 horas', seconds: 24*60*60 },
  { key: 'permanente', label: 'Permanente (~100 dias)', seconds: 100*24*60*60 },
];

export default function ConfiguracoesPage() {
  const [nomeRede, setNomeRede] = useState("Lopesul wi-fi");
  const [manutencao, setManutencao] = useState(false);
  const [sessionKey, setSessionKey] = useState('4h'); // UI key
  const { tema, setTema } = useTheme();

  // carrega config global
  useEffect(() => {
    (async () => {
      try {
        const cfg = await fetch('/api/configuracoes', { cache: 'no-store' }).then(r => r.json());
        setManutencao(!!cfg?.maintenance);

        const match = DUR_OPTIONS.find(o => o.seconds === cfg?.sessionDefault);
        setSessionKey(match?.key || '4h');
      } catch {}
      // locais
      const lr = localStorage.getItem('nomeRede');
      const lt = localStorage.getItem('tema');
      const lm = localStorage.getItem('manutencao');
      if (lr) setNomeRede(lr);
      if (lt) setTema(lt);
      if (lm) setManutencao(lm === 'true');
    })();
  }, [setTema]);

  // salva default no servidor
  async function salvarSessaoPadrao() {
    const seconds = DUR_OPTIONS.find(o => o.key === sessionKey)?.seconds || 4*60*60;
    const res = await fetch('/api/configuracoes', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionDefault: seconds }),
    });
    if (!res.ok) {
      alert('Não foi possível salvar a sessão padrão.');
      return;
    }
    alert('Sessão padrão salva!');
  }

  // alterna manutenção global (servidor) — admin-only
  async function toggleManutencao(next) {
    setManutencao(next);
    const res = await fetch('/api/configuracoes', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ maintenance: next }),
    });
    if (!res.ok) {
      setManutencao(!next);
      alert('Não foi possível atualizar o modo de manutenção (apenas admin).');
    }
    // opcional: manter cópia local para exibir mesmo sem GET
    localStorage.setItem('manutencao', String(next));
  }

  // salva preferências apenas locais (nome/tema) — não impacta server
  function salvarLocais(e) {
    e.preventDefault();
    localStorage.setItem('nomeRede', nomeRede);
    localStorage.setItem('tema', tema);
    alert('Preferências locais salvas.');
  }

  return (
    <div className="p-6 md:p-8 bg-white dark:bg-[#1a2233] min-h-screen transition-colors">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Configurações do Sistema</h1>

      <div className="bg-white dark:bg-[#232e47] rounded-xl p-6 shadow space-y-6 max-w-2xl mb-8">
        <h2 className="font-semibold text-gray-900 dark:text-white">Sessão do Dashboard</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Duração padrão do login (usada quando o formulário de login não informa explicitamente).
        </p>

        <label className="block font-medium mb-1 text-sm dark:text-gray-200">
          Duração padrão da sessão
        </label>
        <select
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 text-sm bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
          value={sessionKey}
          onChange={(e) => setSessionKey(e.target.value)}
        >
          {DUR_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>

        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md"
          onClick={salvarSessaoPadrao}
        >
          Salvar Sessão Padrão
        </button>
      </div>

      <form
        onSubmit={salvarLocais}
        className="bg-white dark:bg-[#232e47] rounded-xl p-6 shadow space-y-6 max-w-2xl"
      >
        <div>
          <label className="block font-medium mb-1 text-sm dark:text-gray-200">Nome da Rede</label>
          <input
            type="text"
            value={nomeRede}
            onChange={e => setNomeRede(e.target.value)}
            placeholder="LOPESUL WI-FI"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 text-sm bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block font-medium mb-1 text-sm dark:text-gray-200">Tema do Sistema</label>
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
          <label className="block font-medium mb-1 text-sm dark:text-gray-200">Modo de Manutenção</label>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="checkbox"
              id="manutencao"
              checked={manutencao}
              onChange={e => toggleManutencao(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="manutencao" className="text-sm dark:text-gray-200">
              Ativar modo de manutenção (bloqueia operadores comuns)
            </label>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Enquanto ativo, apenas o admin consegue acessar o dashboard.
          </p>
        </div>

        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md">
          Salvar Alterações (Locais)
        </button>
      </form>
    </div>
  );
}

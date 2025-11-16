'use client';

import { useEffect, useState } from 'react';

function jsonPretty(v) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? '');
  }
}

export default function RoteadoresDebugPage() {
  const [loading, setLoading] = useState(true);
  const [roteadores, setRoteadores] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [erro, setErro] = useState('');

  async function carregar() {
    try {
      setErro('');
      setLoading(true);
      const res = await fetch('/api/roteadores', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRoteadores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[debug] erro ao carregar roteadores:', e);
      setErro(`Erro ao carregar roteadores: ${String(e?.message || e)}`);
      setRoteadores([]);
    } finally {
      setLoading(false);
    }
  }

  async function testarStatus(r) {
    try {
      const res = await fetch(`/api/roteadores/${r.id}/status`, { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      setStatusMap((prev) => ({
        ...prev,
        [r.id]: {
          httpStatus: res.status,
          body,
        },
      }));
    } catch (e) {
      setStatusMap((prev) => ({
        ...prev,
        [r.id]: {
          httpStatus: 0,
          body: { error: String(e?.message || e) },
        },
      }));
    }
  }

  async function testarTodos() {
    for (const r of roteadores) {
      // chama em sequência para não explodir o relay/mikrotik
      // mas ainda assim é um teste real contra o painel + mikrotiks
      // eslint-disable-next-line no-await-in-loop
      await testarStatus(r);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Debug de Roteadores</h1>
      <p className="text-sm text-gray-500">
        Esta página executa testes reais contra o painel e os Mikrotiks usando as rotas
        <code className="mx-1">/api/roteadores</code>
        e
        <code className="mx-1">/api/roteadores/:id/status</code>.
      </p>

      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={carregar}
          className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          Recarregar lista
        </button>
        <button
          type="button"
          onClick={testarTodos}
          className="px-3 py-1 rounded bg-green-600 text-white text-sm hover:bg-green-700"
          disabled={!roteadores.length}
        >
          Testar status de todos
        </button>
        {loading && <span className="text-sm text-gray-500">Carregando roteadores...</span>}
      </div>

      {erro && (
        <div className="p-3 rounded bg-red-100 text-red-800 text-sm whitespace-pre-wrap">
          {erro}
        </div>
      )}

      {!loading && (roteadores?.length ?? 0) === 0 && !erro && (
        <p className="text-gray-600">Nenhum roteador cadastrado.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roteadores.map((r) => {
          const s = statusMap[r.id];
          return (
            <div
              key={r.id}
              className="border rounded-lg p-3 bg-white shadow-sm text-sm space-y-2"
            >
              <div className="font-semibold">
                {r.nome} <span className="text-xs text-gray-500">({r.id})</span>
              </div>
              <div className="text-xs text-gray-600">
                IP: {r.ipLan} · API: {r.portaApi} · SSH: {r.portaSsh}
              </div>
              <div className="text-xs text-gray-600">
                WG: {r.wgIp || '—'} · PubKey: {r.wgPublicKey ? `${r.wgPublicKey.slice(0, 16)}...` : '—'}
              </div>

              <button
                type="button"
                onClick={() => testarStatus(r)}
                className="mt-1 px-2 py-1 rounded bg-gray-800 text-white text-xs hover:bg-black"
              >
                Testar status
              </button>

              {s && (
                <pre className="mt-2 text-[11px] bg-gray-100 rounded p-2 overflow-x-auto">
                  {jsonPretty(s)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

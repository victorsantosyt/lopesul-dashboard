'use client';

import { useEffect, useState } from 'react';

// === Helpers ===
function formatBRL(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function isOnline(status) {
  const s = String(status ?? '').toLowerCase();
  return ['online', 'on', 'ok', 'up', 'ativo', 'connected'].includes(s);
}

function extractFrotas(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.frotas)) return data.frotas;
  return [];
}

// === Página ===
export default function FrotasPage() {
  const [frotas, setFrotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roteadores, setRoteadores] = useState([]);
  const [roteadoresErro, setRoteadoresErro] = useState('');

  // busca inicial da lista de frotas
  useEffect(() => {
    async function fetchFrotas() {
      try {
        const res = await fetch('/api/frotas');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setFrotas(extractFrotas(data));
      } catch (error) {
        console.error('Erro ao buscar frotas:', error);
        setFrotas([]);
      } finally {
        setLoading(false);
      }
    }
    fetchFrotas();
  }, []);

  // Carrega lista de roteadores para vincular às frotas
  useEffect(() => {
    async function fetchRoteadores() {
      try {
        setRoteadoresErro('');
        const res = await fetch('/api/roteadores', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRoteadores(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Erro ao buscar roteadores:', error);
        setRoteadoresErro('Não foi possível carregar os roteadores.');
        setRoteadores([]);
      }
    }
    fetchRoteadores();
  }, []);

  // Atualiza frotas a cada 15s buscando da API principal
  useEffect(() => {
    if (frotas.length === 0) return;

    const atualizarFrotas = async () => {
      try {
        const res = await fetch('/api/frotas', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setFrotas(extractFrotas(data));
      } catch (error) {
        console.warn('Erro ao atualizar frotas:', error);
      }
    };

    const timer = setInterval(atualizarFrotas, 15000); // 15s
    return () => clearInterval(timer);
  }, [frotas.length]);

  async function handleVincularRoteador(frotaId, novoRoteadorId) {
    try {
      const body = { roteadorId: novoRoteadorId || null };
      const res = await fetch(`/api/frotas/${frotaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setFrotas((prev) =>
        (prev ?? []).map((f) =>
          f.id === frotaId
            ? {
                ...f,
                roteadorId: updated.roteadorId,
                roteadorNome: updated.roteador?.nome ?? null,
                roteadorIpLan: updated.roteador?.ipLan ?? null,
              }
            : f
        )
      );
    } catch (e) {
      console.error('Erro ao vincular roteador à frota:', e);
      alert('Erro ao vincular roteador à frota: ' + String(e?.message || e));
    }
  }

  // === Render ===
  return (
    <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
        Monitoramento de Frotas
      </h1>

      {roteadoresErro && (
        <p className="text-sm text-red-500 mb-2">{roteadoresErro}</p>
      )}

      {loading ? (
        <p className="text-gray-600 dark:text-gray-300">Carregando frotas...</p>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {(frotas ?? []).map((frota) => {
            const valor =
              frota?.valorTotal != null
                ? Number(frota.valorTotal)
                : Number(frota?.valorTotalCentavos ?? 0) / 100;

            const acessos = Number(frota?.acessos ?? 0);
            const statusMikrotik = frota?.statusMikrotik ?? frota?.status;
            const onlineMikrotik = isOnline(statusMikrotik);
            const statusStarlink = frota?.statusStarlink ?? null;
            const onlineStarlink = statusStarlink ? isOnline(statusStarlink) : null;
            const ping = frota?.pingMs ?? null;
            const perda = frota?.perdaPct ?? null;
            const mikrotikHost = frota?.mikrotikHost ?? null;
            const mikrotikIdentity = frota?.mikrotikIdentity ?? null;
            const roteadorNome = frota?.roteadorNome ?? null;
            const roteadorIpLan = frota?.roteadorIpLan ?? null;

            return (
              <div
                key={frota?.id ?? frota?.nome}
                className="bg-white dark:bg-[#232e47] shadow-md rounded-xl p-4 border border-gray-200 dark:border-gray-700 transition-colors"
              >
                <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">
                  {frota?.nome ?? 'Sem nome'}
                </h2>

                <p className="text-gray-700 dark:text-gray-200">
                  <strong>Vendas:</strong> {formatBRL(valor)}
                </p>

                <p className="text-gray-700 dark:text-gray-200">
                  <strong>Acessos:</strong> {acessos} dispositivos
                </p>

                {roteadorNome && (
                  <p className="text-gray-700 dark:text-gray-200 mt-1 text-sm">
                    <strong>Roteador:</strong> {roteadorNome}
                    {roteadorIpLan ? ` (${roteadorIpLan})` : ''}
                  </p>
                )}

                {roteadores.length > 0 && (
                  <div className="mt-1 text-gray-700 dark:text-gray-200 text-xs">
                    <label className="mr-1 font-semibold">Vincular roteador:</label>
                    <select
                      className="bg-white dark:bg-[#1b2438] border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-xs text-gray-900 dark:text-white"
                      value={frota?.roteadorId || ''}
                      onChange={(e) =>
                        handleVincularRoteador(
                          frota.id,
                          e.target.value || null
                        )
                      }
                    >
                      <option value="">Sem roteador</option>
                      {roteadores.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nome} ({r.ipLan})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-2 text-gray-700 dark:text-gray-200">
                  <strong>Status Mikrotik:</strong>{' '}
                  <span
                    className={`inline-block w-3 h-3 rounded-full mr-2 ${
                      onlineMikrotik ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  {onlineMikrotik ? 'online' : 'offline'}
                </div>

                {mikrotikIdentity || mikrotikHost ? (
                  <p className="text-gray-600 dark:text-gray-300 text-xs mt-1">
                    <strong>Mikrotik:</strong>{' '}
                    {mikrotikIdentity ? `${mikrotikIdentity} ` : ''}
                    {mikrotikHost ? `(${mikrotikHost})` : ''}
                  </p>
                ) : null}

                {statusStarlink && (
                  <div className="mt-1 text-gray-700 dark:text-gray-200">
                    <strong>Status Starlink:</strong>{' '}
                    <span
                      className={`inline-block w-3 h-3 rounded-full mr-2 ${
                        onlineStarlink ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    {onlineStarlink ? 'online' : 'offline'}
                  </div>
                )}

                {ping !== null && (
                  <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                    <strong>Latência:</strong> {ping} ms
                    {perda !== null && ` • Perda: ${perda}%`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

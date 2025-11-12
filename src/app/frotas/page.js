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

// === Página ===
export default function FrotasPage() {
  const [frotas, setFrotas] = useState([]);
  const [loading, setLoading] = useState(true);

  // busca inicial da lista de frotas
  useEffect(() => {
    async function fetchFrotas() {
      try {
        const res = await fetch('/api/frotas');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setFrotas(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Erro ao buscar frotas:', error);
        setFrotas([]);
      } finally {
        setLoading(false);
      }
    }
    fetchFrotas();
  }, []);

  // Atualiza status técnico a cada 15s (ping, latência)
  useEffect(() => {
    if (frotas.length === 0) return;

    const atualizarStatus = async () => {
      try {
        const atualizadas = await Promise.all(
          frotas.map(async (frota) => {
            if (!frota?.id) return frota;

            try {
              const res = await fetch(`/api/frotas/${frota.id}/status`);
              if (!res.ok) throw new Error();
              const statusData = await res.json();

              return {
                ...frota,
                pingMs: statusData?.rttMs ?? null,
                perdaPct: statusData?.perdaPct ?? null,
                status: statusData?.pingOk ? 'online' : 'offline',
              };
            } catch {
              return { ...frota, status: 'offline', pingMs: null, perdaPct: null };
            }
          })
        );

        setFrotas(atualizadas);
      } catch (err) {
        console.warn('Falha ao atualizar status:', err);
      }
    };

    atualizarStatus();
    const timer = setInterval(atualizarStatus, 15000); // 15s
    return () => clearInterval(timer);
  }, [frotas.length]);

  // === Render ===
  return (
    <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
        Monitoramento de Frotas
      </h1>

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
            const online = isOnline(frota?.status);
            const ping = frota?.pingMs ?? null;
            const perda = frota?.perdaPct ?? null;

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

                <div className="mt-2 text-gray-700 dark:text-gray-200">
                  <strong>Status Mikrotik:</strong>{' '}
                  <span
                    className={`inline-block w-3 h-3 rounded-full mr-2 ${
                      online ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  {online ? 'online' : 'offline'}
                </div>

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

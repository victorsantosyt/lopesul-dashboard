'use client';

import { useEffect, useState } from 'react';

// formata moeda em BRL com fallback seguro
function formatBRL(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// normaliza status pra decidir a cor do badge
function isOnline(status) {
  const s = String(status ?? '').toLowerCase();
  return ['online', 'on', 'ok', 'up', 'ativo', 'connected'].includes(s);
}

export default function FrotasPage() {
  const [frotas, setFrotas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFrotas() {
      try {
        const res = await fetch('/api/frotas');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setFrotas(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Erro ao buscar frotas:', error);
        setFrotas([]); // garante array
      } finally {
        setLoading(false);
      }
    }
    fetchFrotas();
  }, []);

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

            const acessos = Number(
              frota?.acessos ?? frota?.devices ?? frota?.conexoes ?? 0
            );

            const online = isOnline(frota?.status);

            return (
              <div
                key={frota?.id ?? frota?.nome}
                className="bg-white dark:bg-[#232e47] shadow-md rounded-xl p-4 border border-gray-200 dark:border-gray-700 transition-colors"
              >
                <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">
                  {frota?.nome ?? 'Sem nome'}
                </h2>

                <p className="text-gray-700 dark:text-gray-200">
                  <strong>Vendas:</strong>{' '}
                  {formatBRL(valor)}
                </p>

                <p className="text-gray-700 dark:text-gray-200">
                  <strong>Acessos:</strong> {acessos} dispositivos
                </p>

                <p className="flex items-center gap-2 text-gray-700 dark:text-gray-200 mt-2">
                  <strong>Status do Mikrotik:</strong>
                  <span
                    className={`w-3 h-3 rounded-full ${
                      online ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  {online ? 'online' : String(frota?.status ?? 'desconhecido')}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Wifi, RefreshCcw } from 'lucide-react';

export default function DispositivosPage() {
  const [dispositivos, setDispositivos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // status resumido (Mikrotik/Starlink) carregado sob demanda
  const [statusResumo, setStatusResumo] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusErro, setStatusErro] = useState('');

  async function carregarDispositivos() {
    try {
      setErro('');
      setCarregando(true);
      const res = await fetch('/api/dispositivos', { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao buscar dispositivos');
      const data = await res.json();
      setDispositivos(Array.isArray(data) ? data : data.items ?? []);
    } catch (err) {
      console.error('Erro ao carregar dispositivos:', err);
      setErro('Não foi possível carregar os dispositivos. Verifique sua conexão ou o backend.');
      setDispositivos([]);
    } finally {
      setCarregando(false);
    }
  }

  async function carregarStatus() {
    try {
      setStatusErro('');
      setStatusLoading(true);
      const res = await fetch('/api/dispositivos/status', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setStatusResumo(json);
    } catch (e) {
      console.error('Erro status dispositivos:', e);
      setStatusResumo(null);
      setStatusErro('Não foi possível obter o status técnico agora.');
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    carregarDispositivos();
  }, []);

  return (
    <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors">
      {/* Cabeçalho + botão Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          Painel Técnico — Dispositivos
        </h1>

        <button
          onClick={carregarStatus}
          disabled={statusLoading}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2
                     bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Obter Status"
          title="Obter Status (Mikrotik/Starlink)"
        >
          <Wifi className="h-5 w-5" />
          <span className="hidden sm:inline">{statusLoading ? 'Carregando…' : 'Ver Status'}</span>
        </button>
      </div>

      {/* Bloco de status técnico (carregado sob demanda) */}
      {statusLoading && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">Consultando status…</div>
      )}
      {statusErro && (
        <div className="mb-4 text-sm text-red-600 dark:text-red-400">{statusErro}</div>
      )}
      {statusResumo && (
        <div className="mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#232e47]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800 dark:text-white">Status Técnico</h3>
            <button
              onClick={carregarStatus}
              className="inline-flex items-center gap-2 text-sm px-2 py-1 rounded-lg bg-gray-100 dark:bg-[#2b3754] hover:bg-gray-200 dark:hover:bg-[#314066]"
              title="Atualizar"
            >
              <RefreshCcw className="h-4 w-4" /> Atualizar
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-300">Mikrotik</div>
              <div className="text-gray-800 dark:text-gray-100">
                {statusResumo?.mikrotik?.online ? 'online' : 'offline'}
                {statusResumo?.mikrotik?.lastHost ? ` — host: ${statusResumo.mikrotik.lastHost}` : ''}
                {statusResumo?.mikrotik?.port ? ` (porta ${statusResumo.mikrotik.port})` : ''}
              </div>
              {statusResumo?.mikrotik?.via && (
                <div className="text-gray-500 dark:text-gray-400">via: {statusResumo.mikrotik.via}</div>
              )}
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-300">Starlink</div>
              <div className="text-gray-800 dark:text-gray-100">
                {statusResumo?.starlink?.online ? 'online' : 'offline'}
                {statusResumo?.starlink?.lastHost ? ` — host: ${statusResumo.starlink.lastHost}` : ''}
              </div>
              {statusResumo?.starlink?.via && (
                <div className="text-gray-500 dark:text-gray-400">via: {statusResumo.starlink.via}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold mt-2 mb-3 text-gray-800 dark:text-white">
        Dispositivos Cadastrados
      </h2>

      {carregando && (
        <p className="text-gray-600 dark:text-gray-300">Carregando dispositivos...</p>
      )}

      {!!erro && (
        <p className="text-red-600 dark:text-red-400 mb-3">{erro}</p>
      )}

      {!carregando && !erro && (
        <>
          {dispositivos.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500">
              Nenhum dispositivo cadastrado no momento.
            </p>
          ) : (
            <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {dispositivos.map((d) => (
                <li
                  key={d.id}
                  className="bg-white dark:bg-[#232e47] p-4 border border-gray-200 dark:border-gray-700 rounded-xl shadow transition-all hover:shadow-lg"
                >
                  <div className="space-y-1">
                    <p className="text-gray-800 dark:text-gray-100">
                      <strong>IP:</strong> {d.ip ?? '—'}
                    </p>
                    <p className="text-gray-800 dark:text-gray-100">
                      <strong>Frota:</strong>{' '}
                      {d.frota?.nome || d.frotaId || 'Sem frota'}
                    </p>
                    <p className="text-gray-500 dark:text-gray-300 text-sm">
                      <strong>Criado em:</strong>{' '}
                      {d.criadoEm
                        ? new Date(d.criadoEm).toLocaleString('pt-BR')
                        : '-'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

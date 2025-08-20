'use client';

import { useEffect, useState } from 'react';

export default function DispositivosPage() {
  const [dispositivos, setDispositivos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  async function carregarDispositivos() {
    try {
      setErro('');
      setCarregando(true);
      const res = await fetch('/api/dispositivos', { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao buscar dispositivos');
      const data = await res.json();
      setDispositivos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao carregar dispositivos:', err);
      setErro('Não foi possível carregar os dispositivos.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDispositivos();
  }, []);

  return (
    <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
        Painel Técnico - Dispositivos
      </h1>

      <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-800 dark:text-white">
        Dispositivos Cadastrados
      </h2>

      {carregando && (
        <p className="text-gray-600 dark:text-gray-300">Carregando dispositivos...</p>
      )}

      {!!erro && (
        <p className="text-red-600 dark:text-red-400 mb-3">{erro}</p>
      )}

      {!carregando && !erro && (dispositivos.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500">Nenhum dispositivo cadastrado no momento.</p>
      ) : (
        <ul className="space-y-3">
          {dispositivos.map((d) => (
            <li
              key={d.id}
              className="bg-white dark:bg-[#232e47] p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow flex justify-between items-center transition-colors"
            >
              <div className="space-y-1">
                <p className="text-gray-800 dark:text-gray-100">
                  <strong>IP:</strong> {d.ip}
                </p>
                <p className="text-gray-800 dark:text-gray-100">
                  <strong>Frota:</strong>{' '}
                  {d.frota?.id || d.frotaId || 'Sem frota'}
                </p>
                <p className="text-gray-500 dark:text-gray-300 text-sm">
                  <strong>Criado em:</strong>{' '}
                  {d.criadoEm ? new Date(d.criadoEm).toLocaleString('pt-BR') : '-'}
                </p>
              </div>

              {/* Espaço para ações (editar/remover etc.) */}
              {/* <div className="flex gap-2">
                <button className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Editar</button>
                <button className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white">Remover</button>
              </div> */}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

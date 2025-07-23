'use client';

import { useEffect, useState } from 'react';

export default function DispositivosPage() {
  const [dispositivos, setDispositivos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarDispositivos = async () => {
    try {
      const res = await fetch('/api/dispositivos');
      const data = await res.json();
      setDispositivos(data);
    } catch (err) {
      console.error('Erro ao carregar dispositivos:', err);
    } finally {
      setCarregando(false);
    }
  };

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

      {carregando ? (
        <p className="text-gray-600 dark:text-gray-300">Carregando dispositivos...</p>
      ) : dispositivos.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500">Nenhum dispositivo cadastrado no momento.</p>
      ) : (
        <ul className="space-y-3">
          {dispositivos.map((d) => (
            <li
              key={d.id}
              className="bg-white dark:bg-[#232e47] p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow flex justify-between items-center transition-colors"
            >
              <div>
                <p className="text-gray-800 dark:text-gray-100"><strong>IP:</strong> {d.ip}</p>
                <p className="text-gray-800 dark:text-gray-100"><strong>Frota:</strong> {d.frota?.nome || 'Sem frota'}</p>
                {/* Adicione outros campos conforme necessário */}
              </div>
              {/* Aqui você pode adicionar botões para editar, remover, etc. */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
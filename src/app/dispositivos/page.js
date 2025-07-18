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
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Painel Técnico - Dispositivos</h1>
      <h2 className="text-xl font-semibold mt-6 mb-3">Dispositivos Cadastrados</h2>

      {carregando ? (
        <p>Carregando dispositivos...</p>
      ) : dispositivos.length === 0 ? (
        <p className="text-gray-400">Nenhum dispositivo cadastrado no momento.</p>
      ) : (
        <ul className="space-y-3">
          {dispositivos.map((d) => (
            <li
              key={d.id}
              className="bg-white p-4 border border-gray-200 rounded-lg shadow flex justify-between items-center"
            >
              <div>
                <p><strong>IP:</strong> {d.ip}</p>
                <p><strong>Frota:</strong> {d.frota?.nome || 'Sem frota'}</p>
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
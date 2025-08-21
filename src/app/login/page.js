'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// evita prerender/CSR bailout no build
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DUR_OPTIONS = [
  { key: '3h', label: '3 horas' },
  { key: '4h', label: '4 horas' },
  { key: '6h', label: '6 horas' },
  { key: '24h', label: '24 horas' },
  { key: 'permanente', label: 'Permanente (~100 dias)' },
];

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();            // <- agora dentro de <Suspense>
  const next = sp?.get('next') || '/dashboard';

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [duration, setDuration] = useState('4h');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ usuario, senha, duration }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Falha no login');
      router.replace(next);
    } catch (err) {
      alert(err.message || 'Usuário ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F6FA] dark:bg-[#1a2233]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white dark:bg-[#232e47] p-6 rounded-xl shadow space-y-4"
      >
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Entrar</h1>

        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="Usuário"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
        />
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
        />

        <div>
          <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">
            Duração da sessão
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
          >
            {DUR_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-md"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div />}>
      <LoginInner />
    </Suspense>
  );
}
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Desativa ISR/SSG e cache para evitar erros no build
export const dynamic = 'force-dynamic';
export const revalidate = false;          // <-- precisa ser número >=0 ou false
export const fetchCache = 'force-no-store';

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();       // ok, está dentro do <Suspense/>
  const next = search?.get('next') || '/dashboard';

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr('');

    const data = new FormData(e.currentTarget);
    const usuario = data.get('usuario')?.toString() || '';
    const senha   = data.get('senha')?.toString() || '';
    const duration = data.get('duration')?.toString() || ''; // "3h" | "4h" | "6h" | "24h" | "permanente"

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usuario, senha, duration }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j?.error || 'Falha no login');
      setLoading(false);
      return;
    }
    router.replace(next);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>

      <input name="usuario" placeholder="Usuário" className="w-full border px-3 py-2 rounded" />
      <input name="senha" type="password" placeholder="Senha" className="w-full border px-3 py-2 rounded" />

      {/* seletor de duração da sessão */}
      <select name="duration" className="w-full border px-3 py-2 rounded" defaultValue="4h">
        <option value="3h">3 horas</option>
        <option value="4h">4 horas</option>
        <option value="6h">6 horas</option>
        <option value="24h">24 horas</option>
        <option value="permanente">Permanente (~100d)</option>
      </select>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      <button disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <LoginInner />
    </Suspense>
  );
}
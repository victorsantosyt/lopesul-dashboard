'use client';
import { useEffect, useState } from 'react';

function Chip({ ok, label, sub }) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
        ${ok ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300' : 'bg-red-600/15 text-red-700 dark:text-red-300'}
      `}
      title={sub || label}
      aria-label={`${label}: ${ok ? 'online' : 'offline'}`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}
      />
      <span>{label}</span>
      {typeof sub === 'string' && sub && <span className="opacity-70">• {sub}</span>}
    </div>
  );
}

export default function StatusChips({ refreshMs = 15000 }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    try {
      setErr('');
      const r = await fetch('/api/mikrotik/ping', { cache: 'no-store' });
      const j = await r.json();
      setData(j);
    } catch (e) {
      setErr('Falha ao consultar status');
      setData(null);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);

  const mtkOK = Boolean(data?.ok && data?.connected);
  const starOK = Boolean(data?.internet?.ok);
  const rtt = data?.internet?.rtt_ms != null ? `${data.internet.rtt_ms} ms` : '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip ok={mtkOK} label="MikroTik" sub={data?.identity || data?.host || ''} />
      <Chip ok={starOK} label="Starlink" sub={rtt} />
      {!!err && <span className="text-xs text-red-500">{err}</span>}
    </div>
  );
}

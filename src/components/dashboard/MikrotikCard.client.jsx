// src/components/dashboard/MikrotikCard.client.jsx
'use client';
import { useEffect, useState } from 'react';

export default function MikrotikCard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    fetch('/api/mikrotik/ping', { signal: ctl.signal, cache:'no-store' })
      .then(r => r.json()).then(setData).catch(()=>setData({ ok:false }));
    return () => { clearTimeout(t); ctl.abort(); };
  }, []);

  if (!data) return <div className="card">MikroTik: carregando…</div>;
  if (!data.ok) return <div className="card">MikroTik: offline/indisponível</div>;
  return (
    <div className="card">
      <div>MikroTik: {data.identity || data.host}</div>
      <div>Starlink: {data.internet?.ok ? `OK (${data.internet.rtt_ms ?? '?'} ms)` : 'sem resposta'}</div>
    </div>
  );
}

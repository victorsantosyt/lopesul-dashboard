// src/components/dashboard/MikrotikCard.client.jsx
'use client';

import { useEffect, useState } from 'react';

const TIMEOUT_MS = 3000;

export default function MikrotikCard() {
  const [state, setState] = useState({
    loading: true,
    relay: null,   // { ok: bool, monitoring?: number, error?: string }
    net: null,     // { mikrotik: {online, lastHost, port, via}, starlink: {...} }
  });

  useEffect(() => {
    let interval;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);

    async function fetchAll() {
      const safeJson = async (r) => {
        if (!r) return null;
        try { return await r.json(); } catch { return null; }
      };

      // dispara em paralelo; qualquer falha vira null
      const [relayRes, netRes] = await Promise.allSettled([
        fetch('/api/relay/ping', { cache: 'no-store', signal: ctl.signal }),
        fetch('/api/dispositivos/status', { cache: 'no-store', signal: ctl.signal }),
      ]);

      clearTimeout(timer);

      const relayOk   = relayRes.status === 'fulfilled' ? relayRes.value : null;
      const netOk     = netRes.status === 'fulfilled' ? netRes.value : null;

      const relayJson = await safeJson(relayOk);
      const netJson   = await safeJson(netOk);

      // normaliza formas de retorno
      const relay = relayJson
        ? { ok: !!(relayJson.ok ?? relayJson.success), monitoring: relayJson.monitoring, error: relayJson.error || relayJson.message }
        : { ok: false, error: 'relay_unreachable' };

      const net = netJson ?? { mikrotik: { online: false }, starlink: { online: false } };

      console.log('[MikrotikCard] Raw netJson:', JSON.stringify(netJson));
      console.log('[MikrotikCard] Processed net:', JSON.stringify(net));
      console.log('[MikrotikCard] MikroTik online?:', net?.mikrotik?.online);

      setState({ loading: false, relay, net });
    }

    fetchAll().catch(() => {
      clearTimeout(timer);
      setState({
        loading: false,
        relay: { ok: false, error: 'timeout' },
        net: { mikrotik: { online: false }, starlink: { online: false } },
      });
    });

    // Refresh a cada 10 segundos
    interval = setInterval(fetchAll, 10000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      ctl.abort();
    };
  }, []);

  if (state.loading) {
    return (
      <div className="card">
        <div className="font-semibold mb-1">Conectividade</div>
        <div>carregando…</div>
      </div>
    );
  }

  const { relay, net } = state;
  const mk = net?.mikrotik || {};
  const sl = net?.starlink || {};

  return (
    <div className="card space-y-2">
      <div className="font-semibold">Conectividade</div>

      {/* Relay (VPS → /health) */}
      <div className="flex items-center justify-between">
        <span>Relay (VPS)</span>
        <span title={relay?.error || ''}>
          {relay?.ok ? '🟢 online' : '🔴 offline'}
          {typeof relay?.monitoring === 'number' ? ` · ${relay.monitoring} host(s)` : ''}
        </span>
      </div>

      {/* Mikrotik */}
      <div className="flex items-center justify-between">
        <span>MikroTik</span>
        <span title={mk?.via || ''}>
          {mk?.online ? '🟢 online' : '🔴 offline'}
          {mk?.lastHost ? ` · ${mk.lastHost}` : ''}
          {mk?.port ? `:${mk.port}` : ''}
        </span>
      </div>

      {/* Starlink */}
      <div className="flex items-center justify-between">
        <span>Starlink</span>
        <span title={sl?.via || ''}>
          {sl?.online ? '🟢 online' : '🟠 indisponível'}
          {sl?.lastHost ? ` · ${sl.lastHost}` : ''}
        </span>
      </div>
    </div>
  );
}

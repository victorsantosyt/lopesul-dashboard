// src/app/dispositivos/status/page.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, ShieldCheck, ShieldX, Wifi, Clock, Loader2,
  Info, CheckCircle2, XCircle
} from 'lucide-react';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// === Validação de IP (v4/v6)
const ipv4 =
  /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
const ipv6 =
  /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(([0-9a-f]{1,4}:){1,7}:)|(([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4})|(([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2})|(([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3})|(([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4})|(([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5})|([0-9a-f]{1,4}:)((:[0-9a-f]{1,4}){1,6})|:((:[0-9a-f]{1,4}){1,7}|:))(%.+)?$/i;
const isValidIp = (s) => ipv4.test(s) || ipv6.test(s);

export default function MikrotikStatusPage() {
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingPPP, setLoadingPPP] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [listName, setListName] = useState('paid_clients'); // mantido (layout), mas não é usado pela nova rota
  const [limit, setLimit] = useState(100);
  const [statusItems, setStatusItems] = useState([]); // continuará existindo (pode ficar vazio)
  const [pppRows, setPppRows] = useState([]);
  const [msg, setMsg] = useState(null);
  const [actingIp, setActingIp] = useState(null);
  const [actingAction, setActingAction] = useState(null);

  const busy = loadingStatus || loadingPPP;

  function toast(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  }

  // === NOVA ROTA: /api/dispositivos/status (resumo técnico)
  async function fetchStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/dispositivos/status`, { cache: 'no-store' });
      const j = await res.json();
      if (res.ok) {
        // essa rota não retorna address-list; preservo o layout:
        setIdentity(
          j?.mikrotik?.lastHost
            ? `Mikrotik (${j.mikrotik.lastHost})`
            : (j?.mikrotik?.online ? 'Mikrotik' : null)
        );
        setStatusItems([]); // sem address-list nessa API
      } else {
        setStatusItems([]);
        toast('err', j?.error || 'Falha ao carregar status');
      }
    } catch {
      toast('err', 'Erro de rede ao consultar status');
    } finally {
      setLoadingStatus(false);
    }
  }

  // === NOVA ROTA: /api/hotspot/active (lista sessões)
  async function fetchPPP() {
    setLoadingPPP(true);
    try {
      const res = await fetch(`/api/hotspot/active?limit=${limit}`, { cache: 'no-store' });
      const j = await res.json();
      // aceita array puro ou {items:[...]}
      const rows = Array.isArray(j) ? j : (Array.isArray(j?.items) ? j.items : []);
      setPppRows(rows);
    } catch {
      toast('err', 'Erro de rede ao consultar PPP/Hotspot ativos');
      setPppRows([]);
    } finally {
      setLoadingPPP(false);
    }
  }

  // === AJUSTE: revogar usa /api/hotspot/kick/by-ip
  async function handleRevogar(ip) {
    if (!isValidIp(ip || '')) return toast('err', 'IP inválido');
    setActingIp(ip); setActingAction('revogar');
    try {
      const res = await fetch('/api/hotspot/kick/by-ip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.ok) {
        // (opcional) refletir no banco:
        fetch('/api/sessoes/revogar', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ip }),
        }).catch(()=>{});
        toast('ok', `IP ${ip} revogado`);
        await sleep(300);
        fetchPPP();
      } else {
        toast('err', j?.error || `Falha ao revogar ${ip}`);
      }
    } catch {
      toast('err', `Erro de rede ao revogar ${ip}`);
    } finally {
      setActingIp(null); setActingAction(null);
    }
  }

  // === OBS: “liberar” ficava na API antiga. Se quiser manter o botão, a rota de negócio é /api/liberar-acesso (exige referência de pagamento).
  async function handleLiberar(ip, busId) {
    // Mantido para não quebrar layout, mas agora só dá feedback rápido:
    toast('err', 'Liberação manual mudou para o fluxo de pagamento (/api/liberar-acesso).');
  }

  useEffect(() => {
    fetchStatus();
    fetchPPP();
  }, []);

  const statusCount = statusItems.length;
  const pppCount = pppRows.length;

  return (
    <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors space-y-6">
      {/* Header original mantido */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Status do Mikrotik</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Roteador: {identity ? <span className="font-semibold">{identity}</span> : '—'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 text-sm"
            placeholder="address-list (ex.: paid_clients)"
          />
          <input
            type="number"
            min={10}
            max={500}
            value={limit}
            onChange={(e) =>
              setLimit(Math.max(10, Math.min(500, parseInt(e.target.value || '0', 10))))
            }
            className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 text-sm"
            placeholder="Limite"
          />
          <button
            onClick={() => { fetchStatus(); fetchPPP(); }}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 focus:ring-2 focus:ring-blue-400"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
        </div>
      </div>

      {/* Mensagens */}
      {msg && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            msg.type === 'ok'
              ? 'bg-green-600/10 text-green-700 dark:text-green-300 border border-green-600/30'
              : msg.type === 'err'
              ? 'bg-red-600/10 text-red-700 dark:text-red-300 border border-red-600/30'
              : 'bg-sky-600/10 text-sky-700 dark:text-sky-300 border border-sky-600/30'
          }`}
        >
          {msg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> :
           msg.type === 'err' ? <XCircle className="h-4 w-4" /> :
           <Info className="h-4 w-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Address-list (continua na UI; sem dados nesta API) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            Address-list <span className="font-mono text-gray-500">({listName})</span>
          </h2>
          <span className="text-sm text-gray-600 dark:text-gray-400">Total: {statusCount}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-[640px] w-full text-sm">
            <thead className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="text-left px-3 py-2">IP</th>
                <th className="text-left px-3 py-2">Comentário</th>
                <th className="text-left px-3 py-2">Criado</th>
                <th className="text-left px-3 py-2">Ativo</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {statusItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-500">
                    (Sem dados — /api/dispositivos/status não retorna address-list)
                  </td>
                </tr>
              ) : (
                statusItems.map((it, i) => {
                  const revoking = actingIp === it.address && actingAction === 'revogar';
                  return (
                    <tr key={`${it.address}-${i}`} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 font-mono">{it.address || '—'}</td>
                      <td className="px-3 py-2">{it.comment || '—'}</td>
                      <td className="px-3 py-2">{it.creationTime || '—'}</td>
                      <td className="px-3 py-2">{it.disabled ? 'não' : 'sim'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => it.address && handleRevogar(it.address)}
                          disabled={!it.address || revoking}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 focus:ring-2 focus:ring-red-400"
                        >
                          {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}
                          <span className="hidden md:inline">Revogar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mantido no layout, mas agora só mostra aviso se clicar */}
        <LiberarForm onSubmit={handleLiberar} />
      </section>

      {/* PPP Active (agora vindo de /api/hotspot/active) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-white">
            <Wifi className="h-5 w-5" /> PPP Active
          </h2>
          <span className="text-sm text-gray-600 dark:text-gray-400">Total: {pppCount}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-[640px] w-full text-sm">
            <thead className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">IP</th>
                <th className="text-left px-3 py-2">Caller ID</th>
                <th className="text-left px-3 py-2">Serviço</th>
                <th className="text-left px-3 py-2">Uptime</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pppRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-500">Nenhuma sessão ativa.</td>
                </tr>
              ) : (
                pppRows.map((r, i) => {
                  const ip = r?.address || r?.ip || r?.ipAddress || '';
                  const mac = r?.callerId || r?.mac || r?.caller || '';
                  const name = r?.name || r?.user || r?.username || '—';
                  const svc = r?.service || r?.profile || '—';
                  const up = r?.uptime || r?.uptimeStr || '—';
                  const liberating = actingIp === ip && actingAction === 'liberar';
                  const revoking   = actingIp === ip && actingAction === 'revogar';

                  return (
                    <tr key={`${name}-${ip}-${i}`} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">{name}</td>
                      <td className="px-3 py-2 font-mono">{ip || '—'}</td>
                      <td className="px-3 py-2">{mac || '—'}</td>
                      <td className="px-3 py-2">{svc}</td>
                      <td className="px-3 py-2 flex items-center gap-1">
                        <Clock className="h-4 w-4" /> {up}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => ip && handleRevogar(ip)}
                          disabled={!ip || revoking}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 focus:ring-2 focus:ring-red-400"
                        >
                          {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}
                          <span className="hidden md:inline">Revogar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function LiberarForm({ onSubmit }) {
  const [ip, setIp] = useState('');
  const [busId, setBusId] = useState('');
  const can = useMemo(() => ip.trim().length > 3, [ip]);

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-end gap-2 md:gap-3">
      <div className="flex-1">
        <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">IP</label>
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900"
          placeholder="Ex.: 10.0.0.55"
          inputMode="decimal"
        />
      </div>
      <div className="md:w-64">
        <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">
          Ônibus / Bus ID (opcional)
        </label>
        <input
          value={busId}
          onChange={(e) => setBusId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900"
          placeholder="Ex.: BUS-001"
        />
      </div>
      <div className="md:w-auto">
        <label className="block text-sm mb-1 invisible md:visible"> </label>
        <button
          disabled={!can}
          onClick={() => can && onSubmit(ip.trim(), busId.trim() || undefined)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 focus:ring-2 focus:ring-emerald-400"
        >
          <ShieldCheck className="h-5 w-5" />
          <span>Liberar IP</span>
        </button>
      </div>
    </div>
  );
}
